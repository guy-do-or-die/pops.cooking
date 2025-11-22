from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
from typing import Optional
from web3 import Web3
import json
import subprocess
import base64
from pathlib import Path

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pop contract ABI for reading challenges
POP_ABI = json.loads('''[
    {
        "inputs": [],
        "name": "currentChallenge",
        "outputs": [
            {"internalType": "bytes32", "name": "challengeHash", "type": "bytes32"},
            {"internalType": "uint256", "name": "baseBlock", "type": "uint256"},
            {"internalType": "uint256", "name": "expiresBlock", "type": "uint256"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "tokenOwner",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    }
]''')

# RPC endpoint - should be configurable via env var
# Using Celo Sepolia testnet public RPC endpoint (Ankr)
RPC_URL = os.getenv("RPC_URL", "https://rpc.ankr.com/celo_sepolia")
w3 = Web3(Web3.HTTPProvider(RPC_URL))

print(f"[INIT] Connected to RPC: {RPC_URL}")
print(f"[INIT] Current block: {w3.eth.block_number}")

def extract_screenshot(video_path: str, timestamp_s: float = 1.0) -> str:
    """
    Extract a screenshot from video at given timestamp
    Returns base64-encoded PNG image
    """
    screenshot_path = f"{video_path}_screenshot.png"
    try:
        subprocess.run([
            "ffmpeg", "-i", video_path,
            "-ss", str(timestamp_s),
            "-vframes", "1",
            "-q:v", "2",
            screenshot_path
        ], check=True, capture_output=True)
        
        with open(screenshot_path, "rb") as f:
            img_data = f.read()
            img_base64 = base64.b64encode(img_data).decode('utf-8')
        
        os.remove(screenshot_path)
        return img_base64
    except Exception as e:
        print(f"[ERROR] Failed to extract screenshot: {e}")
        if os.path.exists(screenshot_path):
            os.remove(screenshot_path)
        raise

def upload_to_ipfs(image_base64: str) -> str:
    """
    Upload image to IPFS/Filecoin
    TODO: Integrate with web3.storage or similar service
    For now, returns a mock CID
    """
    # Placeholder - integrate with web3.storage API
    # Example: https://web3.storage/docs/how-tos/upload/
    
    # Mock CID for testing
    import hashlib
    hash_obj = hashlib.sha256(image_base64.encode())
    mock_cid = f"Qm{hash_obj.hexdigest()[:44]}"
    
    print(f"[IPFS] Mock CID generated: {mock_cid}")
    print(f"[IPFS] TODO: Implement actual upload to web3.storage")
    
    return mock_cid

@app.get("/health")
def health_check():
    return {"status": "ok", "tee_mode": True}

@app.post("/verify")
async def verify_clip(
    file: UploadFile = File(...),
    pop_address: str = Form(...)
):
    # Fetch challenge from Pop clone
    try:
        pop_contract = w3.eth.contract(
            address=Web3.to_checksum_address(pop_address),
            abi=POP_ABI
        )
        
        # Get token owner
        token_owner = pop_contract.functions.tokenOwner().call()
        
        # Get current challenge
        challenge_data = pop_contract.functions.currentChallenge().call()
        
        challenge_hash = challenge_data[0].hex()
        base_block = challenge_data[1]
        expires_block = challenge_data[2]
        
        # Verify challenge exists
        if challenge_hash == '0x' + '00' * 32:
            raise HTTPException(status_code=400, detail="No challenge found for this token")
        
        # Verify block validity
        current_block = w3.eth.block_number
        if current_block < base_block or current_block > expires_block:
            raise HTTPException(
                status_code=400,
                detail=f"Challenge expired. Current block: {current_block}, Valid range: {base_block}-{expires_block}"
            )
        
        print(f"[POP] Pop clone: {pop_address}")
        print(f"[POP] Token owner: {token_owner}")
        print(f"[POP] Challenge hash: 0x{challenge_hash}")
        print(f"[POP] Block range: {base_block}-{expires_block} (current: {current_block})")
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch challenge from Pop clone: {str(e)}")
    
    temp_file = f"temp_{file.filename}"
    with open(temp_file, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        from audio import detect_chirps
        from video import detect_strobes, calculate_ssim
        from challenge import derive_challenge
        
        # Derive expected patterns from challenge hash
        derived = derive_challenge('0x' + challenge_hash)
        expected_freqs = derived["audio_frequencies"]
        expected_strobes = derived["strobe_timings"]
        
        print(f"Challenge: 0x{challenge_hash}")
        print(f"Expected frequencies: {expected_freqs}")
        print(f"Expected strobe timings: {expected_strobes}")
        
        # Extract audio using ffmpeg
        audio_path = f"{temp_file}.wav"
        import subprocess
        subprocess.run([
            "ffmpeg", "-i", temp_file, "-vn", 
            "-acodec", "pcm_s16le", "-ar", "44100", "-ac", "1", 
            audio_path
        ], check=True, capture_output=True)
        
        # Detect chirps with expected frequencies
        audio_peaks = detect_chirps(audio_path, expected_freqs)
        
        # Detect strobes (ROI can be adjusted)
        roi = (100, 100, 200, 200) 
        strobe_peaks = detect_strobes(temp_file, roi)
        
        ssim = calculate_ssim(temp_file)
        
        os.remove(audio_path)

        # Convert expected strobe timings (ms) to seconds to match detected peak units.
        # Only consider as many expected times as there are audio tones (typically 3)
        # to avoid over-constraining verification when the challenge has extra strobes.
        expected_times_s_full = [t / 1000.0 for t in expected_strobes]
        expected_times_s = expected_times_s_full[: len(expected_freqs)]
        tolerance_s = 0.6

        matched_audio = []
        matched_strobes = []
        successes = 0
        
        # Track which peaks have been used to prevent reuse
        used_audio_indices = set()
        used_strobe_indices = set()

        for t in expected_times_s:
            if not audio_peaks or not strobe_peaks:
                matched_audio.append(None)
                matched_strobes.append(None)
                continue

            # Find nearest unused audio peak
            nearest_audio = None
            nearest_audio_idx = None
            min_audio_dist = float('inf')
            for i, peak in enumerate(audio_peaks):
                if i not in used_audio_indices:
                    dist = abs(peak - t)
                    if dist < min_audio_dist:
                        min_audio_dist = dist
                        nearest_audio = peak
                        nearest_audio_idx = i
            
            # Find nearest unused strobe peak
            nearest_strobe = None
            nearest_strobe_idx = None
            min_strobe_dist = float('inf')
            for i, peak in enumerate(strobe_peaks):
                if i not in used_strobe_indices:
                    dist = abs(peak - t)
                    if dist < min_strobe_dist:
                        min_strobe_dist = dist
                        nearest_strobe = peak
                        nearest_strobe_idx = i

            ok_here = True
            if nearest_audio is None or abs(nearest_audio - t) > tolerance_s:
                ok_here = False
            if nearest_strobe is None or abs(nearest_strobe - t) > tolerance_s:
                ok_here = False
            if nearest_audio is not None and nearest_strobe is not None:
                if abs(nearest_audio - nearest_strobe) > tolerance_s:
                    ok_here = False

            matched_audio.append(nearest_audio)
            matched_strobes.append(nearest_strobe)

            if ok_here:
                successes += 1
                # Mark these peaks as used
                if nearest_audio_idx is not None:
                    used_audio_indices.add(nearest_audio_idx)
                if nearest_strobe_idx is not None:
                    used_strobe_indices.add(nearest_strobe_idx)

        # Require ALL expected times to match (no misses allowed)
        required = len(expected_times_s)
        alignment_ok = successes >= required

        print(f"[MATCHING] Expected times: {expected_times_s}")
        print(f"[MATCHING] Audio peaks: {audio_peaks}")
        print(f"[MATCHING] Strobe peaks: {strobe_peaks}")
        print(f"[MATCHING] Matched audio: {matched_audio}")
        print(f"[MATCHING] Matched strobes: {matched_strobes}")
        print(f"[MATCHING] Successes: {successes}/{len(expected_times_s)} (required: {required})")
        print(f"[RESULT] Alignment OK: {alignment_ok}, Verified: {alignment_ok}")

        audio_match = alignment_ok
        strobe_match = alignment_ok

        verified = alignment_ok
        
        response = {
            "verified": verified,
            "challenge": '0x' + challenge_hash,
            "metrics": {
                "audio_peaks": audio_peaks,
                "expected_audio_count": len(expected_freqs),
                "detected_audio_count": len(audio_peaks),
                "strobe_peaks": strobe_peaks,
                "expected_strobe_count": len(expected_strobes),
                "detected_strobe_count": len(strobe_peaks),
                "matched_audio_peaks": matched_audio,
                "matched_strobe_peaks": matched_strobes,
                "expected_strobe_times_s": expected_times_s,
                "alignment_ok": alignment_ok,
                "ssim": ssim,
                "audio_match": audio_match,
                "strobe_match": strobe_match
            }
        }
        
        # If verified, extract screenshot and upload to IPFS
        if verified:
            try:
                print("[SCREENSHOT] Extracting screenshot from verified footage...")
                # Extract screenshot at 1 second into the video
                screenshot_base64 = extract_screenshot(temp_file, timestamp_s=1.0)
                
                print("[IPFS] Uploading screenshot to IPFS...")
                ipfs_cid = upload_to_ipfs(screenshot_base64)
                
                # Add IPFS data to response
                response["ipfs_cid"] = ipfs_cid
                response["screenshot_preview"] = f"data:image/png;base64,{screenshot_base64[:100]}..."  # Preview only
                
                print(f"[SUCCESS] Screenshot uploaded: {ipfs_cid}")
            except Exception as e:
                print(f"[ERROR] Failed to process screenshot: {e}")
                # Don't fail verification if screenshot upload fails
                response["ipfs_error"] = str(e)
        
        return response
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "verified": False,
            "error": str(e)
        }
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)
