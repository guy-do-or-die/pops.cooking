# Security Model

## Challenge Verification Flow

### 1. Challenge Generation (On-Chain)
- User calls `generateChallenge()` on the Pops contract
- Contract generates a unique hash from:
  - Previous block hash
  - User address
  - Current block number
  - Current timestamp
- Challenge is valid for 100 blocks (~5 minutes on Celo)
- Challenge stored in `userChallenges[userAddress]`

### 2. Recording (Client-Side)
- Client derives audio frequencies and strobe timings from challenge hash
- Records video with:
  - Synthetic audio chirps at specific frequencies
  - Visual strobes at specific timings
- Both derived deterministically from the same hash

### 3. Verification (TEE/Verifier)
- **Input**: Contract address + User address (NOT the challenge hash)
- **Process**:
  1. Fetch challenge from contract via RPC
  2. Verify challenge hasn't expired (current block ≤ expiresBlock)
  3. Derive expected patterns from challenge hash
  4. Analyze uploaded video:
     - Extract audio and detect chirp frequencies
     - Analyze video frames for strobe timings
  5. Match detected patterns against expected patterns
- **Output**: Verification result with detailed metrics

## Security Properties

### ✅ Prevents Challenge Forgery
- User cannot provide arbitrary challenge hash
- Verifier fetches challenge directly from contract
- Challenge must exist on-chain and be within valid block range

### ✅ Time-Bound Challenges
- Each challenge valid for exactly 100 blocks
- Prevents replay attacks with old challenges
- Forces fresh recordings

### ✅ Deterministic Derivation
- Same hash → same audio frequencies + strobe timings
- Client and server use identical derivation logic
- Minimum 300ms spacing enforced between chirps

### ✅ Multi-Modal Verification
- Audio: Frequency detection with ±50Hz tolerance
- Video: Luminance spike detection in ROI
- Timing: Audio-video synchronization within 600ms
- All 3 expected events must match (no partial credit)

## Attack Vectors & Mitigations

### ❌ Pre-recorded Video
**Attack**: Submit old recording for new challenge
**Mitigation**: Challenge hash changes every time, patterns are unique

### ❌ Synthetic Generation
**Attack**: Generate fake video/audio matching expected patterns
**Mitigation**: Requires knowing challenge hash, which is only valid for 100 blocks

### ❌ Challenge Reuse
**Attack**: Use same challenge multiple times
**Mitigation**: Block expiry enforced on-chain and in verifier

### ❌ Parameter Manipulation
**Attack**: Provide fake challenge parameters
**Mitigation**: Verifier fetches challenge from contract, ignores user input

## Configuration

### Contract
- `CHALLENGE_DURATION`: 100 blocks

### Verifier
- `RPC_URL`: Celo Sepolia RPC endpoint (Ankr)
- Audio tolerance: ±50Hz
- Timing tolerance: 600ms
- Minimum chirp spacing: 300ms
- Required matches: 3/3 (all must succeed)

## Future Enhancements

1. **TEE Attestation**: Add remote attestation to prove verifier runs in secure enclave
2. **On-Chain Verification**: Store verification results on-chain
3. **Slashing**: Penalize failed verifications
4. **Rate Limiting**: Prevent spam verification attempts
