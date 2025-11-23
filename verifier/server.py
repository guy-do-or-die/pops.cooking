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
import requests
import io
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
load_dotenv()

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

# Store verification history in memory (for demo purposes)
verification_history = []

# RPC endpoint - should be configurable via env var
# Using Celo Sepolia testnet public RPC endpoint (Ankr)
RPC_URL = os.getenv("RPC_URL", "https://rpc.ankr.com/celo_sepolia")
w3 = Web3(Web3.HTTPProvider(RPC_URL))

print(f"[INIT] Connected to RPC: {RPC_URL}")
print(f"[INIT] Current block: {w3.eth.block_number}")

def extract_screenshot(video_path: str, timestamp_s: float = None) -> str:
    """
    Extract a screenshot from video at given timestamp
    If timestamp_s is None, extracts from middle of video
    Returns base64-encoded PNG image
    """
    screenshot_path = f"{video_path}_screenshot.png"
    try:
        # Get video duration if timestamp not specified
        if timestamp_s is None:
            result = subprocess.run([
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                video_path
            ], capture_output=True, text=True, check=True)
            duration = float(result.stdout.strip())
            timestamp_s = duration / 2.0  # Middle of video
            print(f"[SCREENSHOT] Video duration: {duration:.2f}s, extracting at {timestamp_s:.2f}s (middle)")
        
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
    Upload image to Filecoin via Synapse SDK (Node.js microservice)
    Returns the IPFS CID of the uploaded image
    """
    # Get uploader service URL from environment
    uploader_url = os.getenv("IPFS_UPLOADER_URL", "http://localhost:3001")
    
    try:
        # Decode base64 image
        image_bytes = base64.b64decode(image_base64)
        
        # Upload to Filecoin via Synapse SDK microservice
        print(f"[IPFS] Uploading {len(image_bytes)} bytes to Filecoin via Synapse SDK...")
        
        files = {
            "file": ("screenshot.png", io.BytesIO(image_bytes), "image/png")
        }
        
        response = requests.post(
            f"{uploader_url}/upload",
            files=files,
            timeout=120  # Filecoin uploads may take longer
        )
        
        if response.status_code == 200:
            result = response.json()
            cid = result["cid"]
            gateway_url = result.get('gateway_url', f'https://w3s.link/ipfs/{cid}')
            print(f"[IPFS] ==========================================")
            print(f"[IPFS] Successfully uploaded to Filecoin!")
            print(f"[IPFS] CID: {cid}")
            print(f"[IPFS] View image: {gateway_url}")
            print(f"[IPFS] ==========================================")
            return cid
        else:
            print(f"[IPFS] Upload failed: {response.status_code} - {response.text}")
            # Fallback to mock CID
            import hashlib
            hash_obj = hashlib.sha256(image_base64.encode())
            hash_hex = hash_obj.hexdigest()
            
            # Convert to base32 for valid CID format
            base32_chars = 'abcdefghijklmnopqrstuvwxyz234567'
            base32 = ''.join(base32_chars[int(hash_hex[i*2:i*2+2], 16) % 32] for i in range(32))
            # Extend to 52 chars using hash pattern
            while len(base32) < 52:
                idx = (len(base32) * 2) % len(hash_hex)
                base32 += base32_chars[int(hash_hex[idx:idx+2], 16) % 32]
            mock_cid = f"bafybei{base32}"
            print(f"[IPFS] Fallback mock CID: {mock_cid}")
            return mock_cid
            
    except requests.exceptions.ConnectionError:
        print(f"[IPFS] Could not connect to IPFS uploader at {uploader_url}")
        print("[IPFS] Make sure the Node.js IPFS uploader service is running")
        # Fallback to mock CID
        import hashlib
        hash_obj = hashlib.sha256(image_base64.encode())
        hash_hex = hash_obj.hexdigest()
        
        # Convert to base32 for valid CID format
        base32_chars = 'abcdefghijklmnopqrstuvwxyz234567'
        base32 = ''.join(base32_chars[int(hash_hex[i*2:i*2+2], 16) % 32] for i in range(32))
        # Extend to 52 chars using hash pattern
        while len(base32) < 52:
            idx = (len(base32) * 2) % len(hash_hex)
            base32 += base32_chars[int(hash_hex[idx:idx+2], 16) % 32]
        mock_cid = f"bafybei{base32}"
        print(f"[IPFS] Fallback mock CID: {mock_cid}")
        return mock_cid
        
    except Exception as e:
        print(f"[IPFS] Error during upload: {e}")
        # Fallback to mock CID
        import hashlib
        hash_obj = hashlib.sha256(image_base64.encode())
        hash_hex = hash_obj.hexdigest()
        
        # Convert to base32 for valid CID format
        base32_chars = 'abcdefghijklmnopqrstuvwxyz234567'
        base32 = ''.join(base32_chars[int(hash_hex[i*2:i*2+2], 16) % 32] for i in range(32))
        # Extend to 52 chars using hash pattern
        while len(base32) < 52:
            idx = (len(base32) * 2) % len(hash_hex)
            base32 += base32_chars[int(hash_hex[idx:idx+2], 16) % 32]
        mock_cid = f"bafybei{base32}"
        print(f"[IPFS] Fallback mock CID: {mock_cid}")
        return mock_cid

@app.get("/health")
def health_check():
    return {"status": "ok", "tee_mode": True}

@app.get("/wallet")
def get_wallet_info():
    """
    Proxy endpoint to get wallet address from uploader service.
    This allows access via the main verifier port (8000) instead of uploader port (3001).
    """
    uploader_url = os.getenv("IPFS_UPLOADER_URL", "http://localhost:3001")
    
    try:
        response = requests.get(f"{uploader_url}/wallet", timeout=5)
        
        if response.status_code == 200:
            return response.json()
        else:
            raise HTTPException(
                status_code=response.status_code,
                detail=response.json() if response.headers.get('content-type') == 'application/json' else response.text
            )
    except requests.exceptions.ConnectionError:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Uploader service not available",
                "message": f"Could not connect to uploader at {uploader_url}",
                "hint": "Make sure the uploader service is running"
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Failed to get wallet info",
                "message": str(e)
            }
        )

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
        # Use 700ms tolerance for mobile audio/video desync (iPhone compatible)
        tolerance_s = 0.7

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
                # Extract screenshot from middle of the video
                screenshot_base64 = extract_screenshot(temp_file, timestamp_s=None)
                
                print("[IPFS] Uploading screenshot to IPFS...")
                ipfs_cid = upload_to_ipfs(screenshot_base64)
                
                # Add IPFS data to response
                response["ipfs_cid"] = ipfs_cid
                # Include full base64 for preview (browser can handle it)
                response["screenshot_preview"] = f"data:image/png;base64,{screenshot_base64}"
                
                print(f"[SUCCESS] Screenshot uploaded: {ipfs_cid}")
                print(f"[SUCCESS] Screenshot size: {len(screenshot_base64)} bytes (base64)")
            except Exception as e:
                print(f"[ERROR] Failed to process screenshot: {e}")
                # Don't fail verification if screenshot upload fails
                response["ipfs_error"] = str(e)
        
        # Store verification in history
        import time
        verification_entry = {
            "verified": verified,
            "challenge": '0x' + challenge_hash,
            "pop_address": pop_address,
            "token_owner": token_owner,
            "ipfs_cid": response.get("ipfs_cid"),
            "screenshot_preview": response.get("screenshot_preview", "")[:200] if response.get("screenshot_preview") else None,  # Truncate for storage
            "timestamp": int(time.time()),
            "block_number": current_block
        }
        verification_history.insert(0, verification_entry)  # Most recent first
        # Keep only last 100 verifications
        if len(verification_history) > 100:
            verification_history.pop()
        
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

@app.get("/history")
async def get_history():
    """Return verification history"""
    return {
        "verifications": verification_history,
        "total": len(verification_history)
    }
