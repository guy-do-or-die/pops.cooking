import cv2
import numpy as np
from typing import List, Tuple

def detect_strobes(video_path: str, roi: Tuple[int, int, int, int]) -> List[float]:
    """
    Detects luminance spikes in a specific ROI.
    roi: (x, y, w, h)
    Returns timestamps of detected strobes.
    """
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    
    x, y, w, h = roi
    prev_lum = 0
    detected_times = []
    frame_idx = 0
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
            
        # Crop to ROI
        crop = frame[y:y+h, x:x+w]
        
        # Convert to grayscale and calculate mean luminance
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        curr_lum = np.mean(gray)
        
        # Simple derivative-based detection
        # If luminance jumps significantly compared to previous frame
        if curr_lum - prev_lum > 50: # Threshold needs tuning
            time = frame_idx / fps
            detected_times.append(time)
            
        prev_lum = curr_lum
        frame_idx += 1
        
    cap.release()
    return detected_times

def calculate_ssim(video_path: str) -> float:
    # Placeholder for SSIM calculation between frames or vs reference
    # For PoC, we might just check if video has content
    return 0.99
