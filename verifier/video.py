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

    # Read all frames and count them (OpenCV frame count is unreliable for WebM)
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        crop = frame[y:y+h, x:x+w]
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        mean_lum = float(np.mean(gray))
        luminance.append(mean_lum)

    cap.release()
    
    # Calculate actual FPS from frame count and duration
    actual_frame_count = len(luminance)
    if fps > 100 or fps <= 0:
        import subprocess
        try:
            # Get actual duration from ffprobe
            result = subprocess.run([
                'ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1', video_path
            ], capture_output=True, text=True, check=True)
            duration = float(result.stdout.strip())
            if duration > 0 and actual_frame_count > 0:
                fps = actual_frame_count / duration
                print(f"[VIDEO] Calculated FPS: {fps:.2f} ({actual_frame_count} frames / {duration:.2f}s)")
            else:
                print(f"[VIDEO] Invalid duration, defaulting to 30 FPS")
                fps = 30.0
        except Exception as e:
            print(f"[VIDEO] Failed to get duration, defaulting to 30 FPS: {e}")
            fps = 30.0
    
    print(f"[VIDEO] Captured {actual_frame_count} frames at {fps:.2f} FPS = {actual_frame_count/fps:.2f}s duration")
    print(f"[VIDEO] ROI: x={x}, y={y}, w={w}, h={h}")

    if not luminance:
        print("[VIDEO] No luminance data!")
        return []

    lum_arr = np.array(luminance)
    diff = np.diff(lum_arr)
    diff = np.insert(diff, 0, 0.0)

    diff_std = float(np.std(diff))
    min_height = max(10.0, 3.0 * diff_std)
    
    print(f"[VIDEO] Luminance diff std: {diff_std:.2f}, min_height: {min_height:.2f}")

    distance = int(fps * 0.4) if fps > 0 else 1
    peaks, properties = find_peaks(diff, height=min_height, distance=distance)
    
    print(f"[VIDEO] Raw peaks detected: {len(peaks)} at frames {peaks.tolist()}")

    times = (peaks / fps) if fps > 0 else peaks
    # Allow early challenge strobes; only drop the very first few frames (<100ms)
    filtered = [float(t) for t in times if t > 0.1]
    
    print(f"[VIDEO] Filtered strobes (>0.1s): {[f'{t:.3f}s' for t in filtered]}")

    return sorted(filtered)

def calculate_ssim(video_path: str) -> float:
    # Placeholder for SSIM calculation between frames or vs reference
    # For PoC, we might just check if video has content
    return 0.99
