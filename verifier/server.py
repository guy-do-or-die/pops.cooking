from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
from typing import Optional

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok", "tee_mode": True}

@app.post("/verify")
async def verify_clip(
    file: UploadFile = File(...),
    challenge: str = Form(...),
    base_block: int = Form(...),
    expires_block: int = Form(...)
):
    temp_file = f"temp_{file.filename}"
    with open(temp_file, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        from audio import detect_chirps
        from video import detect_strobes, calculate_ssim
        from challenge import derive_challenge
        
        # Derive expected patterns from challenge hash
        derived = derive_challenge(challenge)
        expected_freqs = derived["audio_frequencies"]
        expected_strobes = derived["strobe_timings"]
        
        print(f"Challenge: {challenge}")
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
        
        return {
            "verified": verified,
            "challenge": challenge,
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
