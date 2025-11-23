# Uploader Service (Filecoin via Synapse SDK)

Node.js microservice that uploads verified screenshots to Filecoin using the **Synapse SDK** from FilOzone.

Runs inside the ROFL TEE container alongside the Python verifier to ensure screenshots are uploaded from a trusted environment.

## Why This Service?

The main verifier is written in Python, but Synapse SDK only supports JavaScript/TypeScript. This lightweight Express server provides an HTTP API that the Python verifier can call to upload screenshots to Filecoin.

## Prerequisites

1. **Node.js 20+** installed
2. **For local testing**: Filecoin Calibration testnet wallet with test tokens:
   - Get test FIL: https://faucet.calibnet.chainsafe-fil.io/funds.html
   - Get test USDFC: https://forest-explorer.chainsafe.dev/faucet/calibnet_usdfc

## Security Model

### Production (TEE Deployment)
The wallet is **derived from the TEE's attestation secret** - no private key is stored in the container. ROFL provides `TEE_DERIVED_SECRET` as an environment variable, from which a deterministic Filecoin wallet is generated.

**Benefits:**
- No private key storage or management
- Wallet is unique per TEE instance
- Cannot be extracted from outside the TEE
- Fund the derived address once, use forever

**Workflow:**
1. Deploy TEE → ROFL generates attestation secret → Uploader starts
2. Uploader derives wallet address from secret and **logs it prominently**
3. Check logs or call `GET /wallet` endpoint to get the address
4. Fund that address with FIL/USDFC from faucets
5. Uploader is now ready to make Filecoin storage payments

**Getting the wallet address:**

Via logs (on container startup):
```
[IPFS] ========================================
[IPFS] WALLET ADDRESS: 0x1234...5678
[IPFS] ========================================
```

Via API:
```bash
curl https://your-tee-url.rofl.app/wallet
# Returns: { "address": "0x1234...5678", "faucets": {...}, "explorer": "..." }
```

### Development (Local Testing)
Use `FILECOIN_PRIVATE_KEY` environment variable with a test wallet. This is **only for local development** and should never be used in production.

## Setup

```bash
cd uploader

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your Filecoin private key:
# FILECOIN_PRIVATE_KEY=0x...
```

**For TEE Deployment**: This service is packaged into the ROFL container alongside the verifier. Both services communicate via localhost within the TEE.

## Run

```bash
npm start
```

The service runs on port 3001 by default.

## Test

```bash
# Check health
curl http://localhost:3001/health

# Upload a file
curl -F "file=@test.png" http://localhost:3001/upload
```

## API Endpoints

### GET /health

Returns service status and Synapse SDK initialization state.

**Response:**
```json
{
  "status": "ok",
  "synapse_ready": true,
  "network": "filecoin-calibration",
  "wallet_address": "0x1234...5678"
}
```

### GET /wallet

Returns the TEE-derived wallet address for funding.

**Response:**
```json
{
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "network": "filecoin-calibration",
  "faucets": {
    "fil": "https://faucet.calibnet.chainsafe-fil.io/funds.html",
    "usdfc": "https://forest-explorer.chainsafe.dev/faucet/calibnet_usdfc"
  },
  "explorer": "https://calibration.filfox.info/en/address/0x1234...5678"
}
```

### POST /upload

Upload a file to Filecoin.

**Request:**
- `multipart/form-data`
- Field: `file` (binary file data)

**Response:**
```json
{
  "success": true,
  "cid": "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
  "gateway_url": "https://w3s.link/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
  "size": 12345
}
```

## How It Works

1. Receives file upload via HTTP
2. Initializes Synapse SDK with your Filecoin wallet
3. Uploads data to Filecoin storage providers
4. Returns the IPFS CID for the stored data

## Integration with Python Verifier

The Python verifier (`server.py`) calls this service to upload verified screenshots:

```python
response = requests.post(
    "http://localhost:3001/upload",
    files={"file": ("screenshot.png", image_bytes, "image/png")},
    timeout=120
)
cid = response.json()["cid"]
```

## References

- [Synapse SDK Documentation](https://docs.filecoin.cloud/)
- [Filecoin Calibration Testnet](https://docs.filecoin.io/networks/calibration/)
- [FilOzone GitHub](https://github.com/FilOzone/synapse-sdk)
