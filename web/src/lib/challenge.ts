/**
 * Challenge generation utilities for deriving deterministic audio/visual patterns from a hash
 */

export interface ChallengeParams {
    hash: string;
    baseBlock: number;
    expiresBlock: number;
}

export interface DerivedChallenge {
    audioFrequencies: number[];  // 3 frequencies for chirps
    strobeTimings: number[];     // Strobe flash times in ms
    strokeInterval: number;      // How often strobes repeat in ms
}

/**
 * Simple hash function to convert hex string to number
 */
function hashToNumber(hash: string, offset: number = 0): number {
    const slice = hash.slice(offset, offset + 8);
    return parseInt(slice, 16);
}

/**
 * Generate a random challenge hash (simulates getting from contract)
 */
export function generateChallengeHash(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return '0x' + Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Derive deterministic challenge parameters from a hash
 * This should match the logic in the verifier
 */
export function deriveChallenge(hash: string): DerivedChallenge {
    // Remove 0x prefix if present
    const cleanHash = hash.startsWith('0x') ? hash.slice(2) : hash;

    // Derive 3 audio frequencies between 800-2000 Hz
    const audioFrequencies = [0, 1, 2].map(i => {
        const num = hashToNumber(cleanHash, i * 8);
        return 800 + (num % 1200); // Range: 800-2000 Hz
    });

    // Derive strobe timings (when strobes should appear within 5s recording)
    // Generate 3 strobes with minimum 300ms spacing to ensure audio chirps are detectable
    const strobeCount = 3;
    const minSpacing = 300; // Minimum 300ms between chirps
    const strobeTimings: number[] = [];
    
    for (let i = 0; i < strobeCount; i++) {
        let timing: number;
        let attempts = 0;
        const maxAttempts = 100;
        
        do {
            const num = hashToNumber(cleanHash, (i + 3 + attempts) * 8);
            // Spread across 5 seconds, leaving room at edges
            timing = 200 + (num % 4600); // Range: 200-4800ms
            attempts++;
            
            // Check if this timing is far enough from all existing timings
            const isFarEnough = strobeTimings.every(existing => 
                Math.abs(timing - existing) >= minSpacing
            );
            
            if (isFarEnough || attempts >= maxAttempts) {
                break;
            }
        } while (true);
        
        strobeTimings.push(timing);
    }
    
    strobeTimings.sort((a, b) => a - b);

    // Strobe duration is fixed at 100ms
    const strokeInterval = 1500;

    return {
        audioFrequencies,
        strobeTimings,
        strokeInterval
    };
}

/**
 * Format challenge for submission to verifier
 */
export function formatChallengeForVerifier(challenge: ChallengeParams): FormData {
    const formData = new FormData();
    formData.append('challenge', challenge.hash);
    formData.append('base_block', challenge.baseBlock.toString());
    formData.append('expires_block', challenge.expiresBlock.toString());
    return formData;
}
