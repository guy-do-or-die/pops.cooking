"""
Challenge derivation logic for the verifier - must match web/src/lib/challenge.ts
"""

def hash_to_number(challenge_hash: str, offset: int = 0) -> int:
    """Convert hex hash to number at given offset"""
    # Remove 0x prefix if present
    clean_hash = challenge_hash[2:] if challenge_hash.startswith('0x') else challenge_hash
    slice_str = clean_hash[offset:offset + 8]
    return int(slice_str, 16)

def derive_challenge(challenge_hash: str):
    """
    Derive deterministic challenge parameters from a hash
    Must match the logic in web/src/lib/challenge.ts
    """
    clean_hash = challenge_hash[2:] if challenge_hash.startswith('0x') else challenge_hash
    
    # Derive 3 audio frequencies between 800-2000 Hz
    audio_frequencies = []
    for i in range(3):
        num = hash_to_number(clean_hash, i * 8)
        freq = 800 + (num % 1200)  # Range: 800-2000 Hz
        audio_frequencies.append(freq)
    
    # Derive strobe timings (when strobes should appear within 5s recording)
    strobe_count = 3 + (hash_to_number(clean_hash, 24) % 3)  # 3-5 strobes
    strobe_timings = []
    for i in range(strobe_count):
        num = hash_to_number(clean_hash, (i + 3) * 8)
        # Spread strobes across 5 seconds
        timing = num % 5000
        strobe_timings.append(timing)
    
    strobe_timings.sort()
    
    return {
        "audio_frequencies": audio_frequencies,
        "strobe_timings": strobe_timings,
        "strobe_interval": 1500
    }
