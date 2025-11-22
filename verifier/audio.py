import numpy as np
from typing import List, Tuple
from scipy.io import wavfile
from scipy.signal import stft

def detect_chirps(audio_path: str, target_freqs: List[float], tolerance: float = 50.0) -> List[float]:
    """
    Detects timestamps of target frequencies in the audio file.
    Returns a list of timestamps (seconds) where the target frequencies were strongest.
    """
    # Load mono audio
    sr, y = wavfile.read(audio_path)

    # Convert to float and mix down if multi-channel
    if y.dtype.kind in {"i", "u"}:
        y = y.astype(np.float32) / np.iinfo(y.dtype).max
    else:
        y = y.astype(np.float32)

    if y.ndim > 1:
        y = np.mean(y, axis=1)

    # Compute STFT using scipy
    n_fft = 2048
    hop_length = 512
    f, t, Zxx = stft(y, fs=sr, nperseg=n_fft, noverlap=n_fft - hop_length, boundary=None)
    S = np.abs(Zxx)

    detected_times = []

    # For each time frame, find the peak frequency
    for i in range(S.shape[1]):
        frame_mag = S[:, i]
        if frame_mag.size == 0:
            continue

        peak_idx = int(np.argmax(frame_mag))
        peak_freq = float(f[peak_idx])
        
        # Check if peak matches any target
        for target in target_freqs:
            if abs(peak_freq - target) < tolerance:
                # Only record if magnitude is significant (simple threshold)
                if frame_mag[peak_idx] > np.mean(frame_mag) * 2:
                    detected_times.append(float(t[i]))
                    break
                        
    # Dedup timestamps (simple clustering could be better but this is PoC)
    # We just return raw detections for now, the verifier logic will check alignment
    return detected_times
