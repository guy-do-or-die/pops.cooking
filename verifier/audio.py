import librosa
import numpy as np
from typing import List, Tuple

def detect_chirps(audio_path: str, target_freqs: List[float], tolerance: float = 50.0) -> List[float]:
    """
    Detects timestamps of target frequencies in the audio file.
    Returns a list of timestamps (seconds) where the target frequencies were strongest.
    """
    # Load audio
    y, sr = librosa.load(audio_path, sr=None)
    
    # Compute STFT
    n_fft = 2048
    hop_length = 512
    D = librosa.stft(y, n_fft=n_fft, hop_length=hop_length)
    S = np.abs(D)
    freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)
    
    detected_times = []
    
    # For each time frame, find the peak frequency
    for i in range(S.shape[1]):
        frame_mag = S[:, i]
        peak_idx = np.argmax(frame_mag)
        peak_freq = freqs[peak_idx]
        
        # Check if peak matches any target
        for target in target_freqs:
            if abs(peak_freq - target) < tolerance:
                # Only record if magnitude is significant (simple threshold)
                if frame_mag[peak_idx] > np.mean(frame_mag) * 2:
                    time = librosa.frames_to_time(i, sr=sr, hop_length=hop_length)
                    detected_times.append(time)
                    break
                    
    # Dedup timestamps (simple clustering could be better but this is PoC)
    # We just return raw detections for now, the verifier logic will check alignment
    return detected_times
