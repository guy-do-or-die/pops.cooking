import numpy as np
import cv2
import soundfile as sf
import os
from audio import detect_chirps
from video import detect_strobes

def generate_test_assets():
    # Generate Audio with chirps at 900, 1200, 1500 Hz
    sr = 44100
    duration = 5.0
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    audio = np.zeros_like(t)
    
    # Add chirps
    chirp_times = [1.0, 2.5, 4.0]
    freqs = [900, 1200, 1500]
    
    for i, time in enumerate(chirp_times):
        # 100ms chirp
        start_idx = int(time * sr)
        end_idx = int((time + 0.1) * sr)
        segment_t = t[start_idx:end_idx]
        audio[start_idx:end_idx] += 0.5 * np.sin(2 * np.pi * freqs[i] * segment_t)
        
    sf.write('test.wav', audio, sr)
    print("Generated test.wav")
    
    # Generate Video with strobes
    width, height = 640, 480
    fps = 30
    out = cv2.VideoWriter('test.mp4', cv2.VideoWriter_fourcc(*'mp4v'), fps, (width, height))
    
    # Strobe times matching audio roughly
    strobe_frames = [int(t * fps) for t in chirp_times]
    
    for i in range(int(duration * fps)):
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        
        # Draw strobe if current frame is a strobe frame
        is_strobe = False
        for sf_idx in strobe_frames:
            if i >= sf_idx and i < sf_idx + 3: # 3 frames duration
                is_strobe = True
                break
        
        if is_strobe:
            # White rectangle in ROI (100, 100, 200, 200)
            cv2.rectangle(frame, (100, 100), (300, 300), (255, 255, 255), -1)
            
        out.write(frame)
        
    out.release()
    print("Generated test.mp4")

def test_detection():
    print("Testing detection...")
    
    # Test Audio
    detected_audio = detect_chirps('test.wav', [900, 1200, 1500])
    print(f"Detected Audio Chirps: {detected_audio}")
    
    # Test Video
    # ROI: x=100, y=100, w=200, h=200
    detected_video = detect_strobes('test.mp4', (100, 100, 200, 200))
    print(f"Detected Video Strobes: {detected_video}")
    
    # Cleanup
    os.remove('test.wav')
    os.remove('test.mp4')

if __name__ == "__main__":
    generate_test_assets()
    test_detection()
