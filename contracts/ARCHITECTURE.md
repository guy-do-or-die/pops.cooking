# Pops Architecture

## Overview

The Pops system uses an ERC1155 factory pattern with cloneable progress tracking contracts.

## Contracts

### PopsFactory (ERC1155 + Clones)
- **Purpose**: Mint tokens and deploy Pop clones
- **Inherits**: OpenZeppelin's ERC1155, Ownable
- **Key Features**:
  - Each token mint creates a new Pop clone
  - Maps token IDs to Pop clone addresses
  - Only factory owner can record verified progress

### Pop (Cloneable Implementation)
- **Purpose**: Store challenges and progress for a single token
- **Inherits**: OpenZeppelin's Initializable
- **Key Features**:
  - One Pop instance per token
  - Only token owner can generate challenges
  - Factory can record verified progress
  - Stores complete progress history

## Flow

### 1. Minting a Token
```solidity
(uint256 tokenId, address popClone) = factory.mint(userAddress);
```
- User calls `mint()` on PopsFactory
- Factory mints ERC1155 token with new ID
- Factory clones Pop implementation
- Pop clone is initialized with token owner
- Mappings are stored: tokenId ↔ popClone

### 2. Generating a Challenge
```solidity
Pop pop = Pop(popClone);
(bytes32 hash, uint256 base, uint256 expires) = pop.generateChallenge();
```
- Token owner calls `generateChallenge()` on their Pop clone
- Challenge hash is generated from:
  - Previous block hash
  - Token owner address
  - Pop clone address
  - Current block number
  - Current timestamp
- Challenge valid for 100 blocks
- Only token owner can generate challenges

### 3. Verification & Progress Recording
```solidity
factory.recordProgress(popClone, challengeHash);
```
- Verifier (factory owner) validates video/audio
- If valid, factory calls `recordProgress()` on Pop clone
- Progress entry is added to history with:
  - Challenge hash
  - Timestamp
  - Verified flag

## Security Model

### Access Control
- **Token Owner**: Can generate challenges on their Pop clone
- **Factory Owner**: Can record verified progress on any Pop clone
- **Anyone**: Can read challenges and progress (view functions)

### Challenge Uniqueness
Each challenge is unique because it includes:
- Block hash (unpredictable)
- Token owner address (unique per token)
- Pop clone address (unique per token)
- Block number + timestamp (temporal uniqueness)

### Progress Integrity
- Only factory can record progress
- Progress is immutable once recorded
- Complete history is preserved
- Each entry is timestamped

## Verifier Integration

The verifier needs to:
1. Accept: `popCloneAddress` (instead of contract + user address)
2. Fetch challenge from: `Pop(popClone).currentChallenge()`
3. Verify: Token owner matches via `Pop(popClone).tokenOwner()`
4. Record: Call factory to record progress (requires factory owner key)

## Gas Optimization

- Uses minimal proxy pattern (Clones) for Pop instances
- Each clone is ~45 bytes of bytecode
- Initialization happens once per clone
- Progress stored in dynamic array (efficient for sequential writes)

## Deployment

```bash
# Deploy PopsFactory (deploys Pop implementation automatically)
forge script script/DeployFactory.s.sol --rpc-url $RPC_URL --broadcast

# The factory address is your main contract
# Pop implementation is deployed automatically
```

## Testing

```bash
forge test -vv
```

Tests cover:
- Token minting and Pop clone deployment
- Challenge generation by token owner
- Access control (only owner can generate)
- Progress recording by factory
- Multiple tokens with separate Pop clones
