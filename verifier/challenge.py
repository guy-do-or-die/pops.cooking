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
    # Generate 3 strobes with minimum 300ms spacing to ensure audio chirps are detectable
    strobe_count = 3
    min_spacing = 300  # Minimum 300ms between chirps
    strobe_timings = []
    
    for i in range(strobe_count):
        timing = None
        attempts = 0
        max_attempts = 100
        
        while attempts < max_attempts:
            num = hash_to_number(clean_hash, (i + 3 + attempts) * 8)
            # Spread across 5 seconds, leaving room at edges
            candidate_timing = 200 + (num % 4600)  # Range: 200-4800ms
            attempts += 1
            
            # Check if this timing is far enough from all existing timings
            is_far_enough = all(
                abs(candidate_timing - existing) >= min_spacing 
                for existing in strobe_timings
            )
            
            if is_far_enough or attempts >= max_attempts:
                timing = candidate_timing
                break
        
        if timing is not None:
            strobe_timings.append(timing)
    
    strobe_timings.sort()
    
    return {
        "audio_frequencies": audio_frequencies,
        "strobe_timings": strobe_timings,
        "strobe_interval": 1500
    }
