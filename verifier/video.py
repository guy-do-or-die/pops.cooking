import cv2
import numpy as np
from typing import List, Tuple
from scipy.signal import find_peaks

def detect_strobes(video_path: str, roi: Tuple[int, int, int, int]) -> List[float]:
    """
    Detects luminance spikes in a specific ROI.
    roi: (x, y, w, h)
    Returns timestamps of detected strobes.
    """
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)

    x, y, w, h = roi
    luminance = []

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        crop = frame[y:y+h, x:x+w]
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        mean_lum = float(np.mean(gray))
        luminance.append(mean_lum)

    cap.release()

    if not luminance:
        return []

    lum_arr = np.array(luminance)
    diff = np.diff(lum_arr)
    diff = np.insert(diff, 0, 0.0)

    diff_std = float(np.std(diff))
    min_height = max(10.0, 3.0 * diff_std)

    distance = int(fps * 0.4) if fps > 0 else 1
    peaks, properties = find_peaks(diff, height=min_height, distance=distance)

    times = (peaks / fps) if fps > 0 else peaks
    # Allow early challenge strobes; only drop the very first few frames (<100ms)
    filtered = [float(t) for t in times if t > 0.1]

    return sorted(filtered)

def calculate_ssim(video_path: str) -> float:
    # Placeholder for SSIM calculation between frames or vs reference
    # For PoC, we might just check if video has content
    return 0.99
