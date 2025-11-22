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
    print(f"[AUDIO] Loaded audio: sr={sr}, duration={len(y)/sr:.2f}s")
    
    # Compute STFT
    n_fft = 2048
    hop_length = 512
    D = librosa.stft(y, n_fft=n_fft, hop_length=hop_length)
    S = np.abs(D)
    freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)
    
    print(f"[AUDIO] Looking for frequencies: {target_freqs} Hz (tolerance ±{tolerance} Hz)")
    
    detected_times = []
    
    # Use a more lenient threshold: mean + 1 std dev
    mean_mag = np.mean(S)
    std_mag = np.std(S)
    frame_threshold = mean_mag + std_mag
    print(f"[AUDIO] Frame magnitude: mean={mean_mag:.4f}, std={std_mag:.4f}, threshold={frame_threshold:.4f}")
    
    # For each time frame, find the peak frequency
    matches_by_freq = {freq: [] for freq in target_freqs}
    all_detections = []  # Track all potential matches for debugging
    
    for i in range(S.shape[1]):
        frame_mag = S[:, i]
        peak_idx = np.argmax(frame_mag)
        peak_freq = freqs[peak_idx]
        peak_mag = frame_mag[peak_idx]
        
        # Check if peak matches any target
        for target in target_freqs:
            if abs(peak_freq - target) < tolerance:
                time = librosa.frames_to_time(i, sr=sr, hop_length=hop_length)
                all_detections.append((time, target, peak_freq, peak_mag))
                # Only record if magnitude is significant
                if peak_mag > frame_threshold:
                    detected_times.append(time)
                    matches_by_freq[target].append((time, peak_freq, peak_mag))
                    break
    
    # Debug: show all potential matches even if below threshold
    if all_detections and not detected_times:
        print(f"[AUDIO] Found {len(all_detections)} potential matches below threshold:")
        for t, target, freq, mag in all_detections[:5]:  # Show first 5
            print(f"  {t:.3f}s: {target}Hz (actual={freq:.1f}Hz, mag={mag:.4f})")
    
    print(f"[AUDIO] Raw detections before clustering: {len(detected_times)}")
    for freq, matches in matches_by_freq.items():
        if matches:
            print(f"  {freq}Hz: {len(matches)} frames")
    
    if not detected_times:
        print("[AUDIO] No chirps detected!")
        return []
    
    # Cluster nearby detections per frequency (within 200ms) into single events
    # Process each frequency separately so close chirps of different frequencies aren't merged
    clustered = []
    cluster_radius = 0.2  # seconds
    
    for freq in target_freqs:
        freq_matches = matches_by_freq[freq]
        if not freq_matches:
            continue
        
        # Sort by time and take the median time for this frequency
        freq_times = sorted([t for t, _, _ in freq_matches])
        
        # Cluster this frequency's detections
        freq_clustered = []
        for t in freq_times:
            if not freq_clustered or abs(t - freq_clustered[-1]) > cluster_radius:
                freq_clustered.append(t)
        
        # Add this frequency's clusters to the main list
        clustered.extend(freq_clustered)
    
    clustered = sorted(clustered)
    print(f"[AUDIO] Clustered detections: {[f'{t:.3f}s' for t in clustered]}")
    return clustered
