# Pops - Proof of Pop

On-chain proof-of-work system where users mint NFTs (Pops) and complete audio-visual challenges verified by a TEE to record verifiable progress on Celo blockchain with screenshots stored on Filecoin.

## Project Structure

```
pops/
├── contracts/          # Solidity smart contracts (Foundry)
│   ├── src/
│   │   ├── Pops.sol   # ERC1155 factory contract
│   │   └── Pop.sol    # Individual Pop clone contract
│   ├── test/
│   ├── script/
│   └── deploy.sh      # Deployment script
│
├── web/               # React frontend (Vite + TypeScript)
│   ├── src/
│   │   ├── pages/     # Home, PopPage
│   │   ├── components/# Capture component
│   │   └── lib/       # ABIs, wagmi config
│   └── vite.config.ts
│
├── verifier/          # Python FastAPI TEE verifier
│   ├── server.py      # Verification logic
│   ├── audio.py       # Audio chirp detection
│   ├── video.py       # Strobe detection
│   └── Dockerfile     # TEE deployment
│
└── uploader/          # Node.js Filecoin uploader (Synapse SDK)
    ├── server.js      # Express API for IPFS uploads to Filecoin
    └── package.json   # Runs in TEE alongside verifier
```

## How It Works

1. **Mint**: User mints a Pop NFT → Factory deploys a Pop clone → Initial challenge auto-generated
2. **Challenge**: Pop generates deterministic audio chirps + video strobes based on blockchain randomness
3. **Record**: User records video with audio playing and screen visible
4. **Verify**: TEE verifier analyzes audio/video, extracts screenshot, uploads to Filecoin
5. **Record Progress**: User signs transaction to record verified progress + IPFS CID on-chain

## Tech Stack

- **Blockchain**: Celo Sepolia (EVM)
- **Contracts**: Solidity + Foundry
- **Frontend**: React + TypeScript + Vite + wouter + wagmi + Privy
- **Verifier**: Python + FastAPI + OpenCV + librosa
- **TEE**: Oasis ROFL
- **Storage**: Filecoin (via Synapse SDK)

## Quick Start

### 1. Deploy Contracts

```bash
cd contracts
./deploy.sh
```

### 2. Start Uploader (Filecoin via Synapse SDK)

```bash
cd uploader
npm install
cp .env.example .env
# Add your Filecoin private key to .env
npm start  # Runs on port 3001
```

**Note**: In production TEE deployment, both verifier and uploader run together in the same ROFL container.

### 3. Start Verifier

```bash
cd verifier
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --reload  # Runs on port 8000
```

### 4. Start Web App

```bash
cd web
npm install
npm run dev  # Runs on port 5173
```

## Deployed Contracts (Celo Sepolia)

- **Pops Factory**: `0xE41bf4033d7F581989a0EC30547BcC07E5c9d267`
- **Pop Implementation**: `0x180C52fc9C1D57D868Eb65147B04CA491c1BA8E1`

View on [Celo Sepolia Explorer](https://celo-sepolia.blockscout.com/address/0xE41bf4033d7F581989a0EC30547BcC07E5c9d267)

## Features

✅ ERC1155 NFTs with cloneable Pop contracts  
✅ Deterministic challenge generation  
✅ Audio chirp + video strobe verification  
✅ TEE-based verifier (Oasis ROFL)  
✅ Screenshot extraction from verified footage  
✅ Filecoin storage via Synapse SDK  
✅ On-chain progress recording with IPFS CIDs  
✅ Auto-generated challenges on mint  
✅ **TEE-derived wallet** for secure Filecoin payments (no private key storage)

## Security Architecture

### TEE-Based Uploads
Screenshots are verified and uploaded to Filecoin entirely **within the ROFL TEE**:

1. **Verifier** (Python) runs in TEE, analyzes video, extracts screenshot
2. **Uploader** (Node.js) runs in same TEE, uploads to Filecoin via Synapse SDK
3. **Wallet** is derived from TEE attestation secret (no private key in container)
4. **IPFS CID** returned to user for on-chain recording

This ensures screenshots cannot be tampered with - they're uploaded directly from the trusted environment.

## License

MIT
