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
    
    # Call verification logic
    try:
        from audio import detect_chirps
        from video import detect_strobes, calculate_ssim
        
        # Extract audio using ffmpeg (requires ffmpeg installed)
        audio_path = f"{temp_file}.wav"
        import subprocess
        subprocess.run(["ffmpeg", "-i", temp_file, "-vn", "-acodec", "pcm_s16le", "-ar", "44100", "-ac", "1", audio_path], check=True)
        
        # Detect chirps (example target freqs)
        # In real app, these come from the challenge seed
        target_freqs = [900, 1200, 1500] 
        audio_peaks = detect_chirps(audio_path, target_freqs)
        
        # Detect strobes (example ROI)
        # In real app, ROI comes from challenge/calibration
        roi = (100, 100, 200, 200) 
        strobe_peaks = detect_strobes(temp_file, roi)
        
        ssim = calculate_ssim(temp_file)
        
        os.remove(audio_path)
        
        return {
            "verified": True, # TODO: Add actual check against challenge
            "challenge": challenge,
            "metrics": {
                "audio_peaks": audio_peaks,
                "strobe_peaks": strobe_peaks,
                "ssim": ssim
            }
        }
    except Exception as e:
        return {
            "verified": False,
            "error": str(e)
        }
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)
