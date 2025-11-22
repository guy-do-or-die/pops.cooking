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
    // Let's have 3-5 strobes
    const strobeCount = 3 + (hashToNumber(cleanHash, 24) % 3); // 3-5 strobes
    const strobeTimings = Array.from({ length: strobeCount }, (_, i) => {
        const num = hashToNumber(cleanHash, (i + 3) * 8);
        // Spread strobes across 5 seconds
        return (num % 5000);
    }).sort((a, b) => a - b);

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
