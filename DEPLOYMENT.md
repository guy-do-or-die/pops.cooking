# Deployment Guide

## Prerequisites

1. Foundry installed
2. Wallet account configured in Foundry (`cast wallet import default`)
3. Celo Sepolia testnet funds

## Deploy PopsFactory

```bash
cd contracts
./deploy.sh
```

This will:
1. Deploy `PopsFactory` contract
2. Deploy `Pop` implementation (automatically via factory constructor)
3. Update `contracts/.env` with `POPS_FACTORY_ADDRESS`
4. Update `web/.env` with `VITE_POPS_FACTORY_ADDRESS`

## After Deployment

### 1. Update Verifier RPC

The verifier needs to connect to Celo Sepolia. If Ankr RPC has issues, update:

`verifier/server.py`:
```python
RPC_URL = os.getenv("RPC_URL", "https://alfajores-forno.celo-testnet.org")
```

Or set `RPC_URL` environment variable when running the Docker container.

### 2. Rebuild Verifier

```bash
cd verifier
docker build -t pops-verifier:poc .
docker run --rm -p 8000:8000 pops-verifier:poc
```

### 3. Test the Flow

1. **Mint Token & Generate Challenge**:
   - Connect wallet in web app
   - Click "Mint & Generate" button
   - This will:
     - Mint an ERC1155 token
     - Deploy a Pop clone
     - Generate a challenge on the Pop clone

2. **Record Video**:
   - Click "Start Recording"
   - Wait 5 seconds for auto-stop
   - Video will contain audio chirps and visual strobes

3. **Verify**:
   - Click "Verify"
   - Verifier will:
     - Fetch challenge from Pop clone via RPC
     - Verify block validity
     - Analyze video/audio
     - Return verification result

## TEE Deployment (ROFL)

### 1. Deploy TEE Container

Deploy verifier + uploader to ROFL TEE using `oasis rofl` CLI.

### 2. Get TEE Wallet Address

**Immediately after deployment**, the uploader will derive a wallet from the TEE attestation secret and log it:

```bash
# Check container logs
oasis rofl logs <deployment-name>

# Look for:
[IPFS] ========================================
[IPFS] WALLET ADDRESS: 0x1234567890abcdef...
[IPFS] ========================================
```

Or query the API (via main verifier port):
```bash
curl https://p8000.your-tee.rofl.app/wallet

# Returns:
# {
#   "address": "0x1234567890abcdef...",
#   "faucets": { "fil": "...", "usdfc": "..." },
#   "explorer": "https://calibration.filfox.info/en/address/0x..."
# }
```

**Note**: The `/wallet` endpoint is proxied through the verifier (port 8000) for convenience. You can also access it directly on the uploader service (port 3001).

### 3. Fund the Wallet

The TEE-derived wallet needs FIL and USDFC to pay for Filecoin storage:

1. **Get test FIL**: Visit https://faucet.calibnet.chainsafe-fil.io/funds.html
   - Paste the wallet address from step 2
   - Request testnet FIL (for gas)

2. **Get test USDFC**: Visit https://forest-explorer.chainsafe.dev/faucet/calibnet_usdfc
   - Paste the wallet address
   - Request test USDFC (for storage payments)

3. **Verify funding**: Check the explorer link from `/wallet` endpoint

### 4. Test Upload

Once funded, screenshots will be uploaded to Filecoin automatically:

```bash
# Verify uploader is ready
curl https://p3001.your-tee.rofl.app/health
# Returns: { "synapse_ready": true, "wallet_address": "0x..." }
```

### Security Notes

- **No private key** is stored in the TEE container
- Wallet is **derived from TEE attestation** secret (ROFL provides this)
- Wallet is **deterministic** - same TEE instance = same address
- You fund the address **once**, it persists across restarts
- Private key **cannot be extracted** from outside the TEE

## Architecture

- **Pops**: ERC1155 token contract + clone factory
- **Pop**: Cloneable contract (one per token)
  - Stores challenges
  - Stores progress history with IPFS CIDs
  - Only token owner can generate challenges
- **Verifier**: Runs in TEE, validates recordings, extracts screenshots
- **Uploader**: Runs in TEE, uploads screenshots to Filecoin via Synapse SDK

## Troubleshooting

### RPC Connection Issues

If you see "Connection timed out" or "failed to get latest block number":

1. Try different RPC endpoints:
   - Ankr: `https://rpc.ankr.com/celo_sepolia`
   - Celo Official: `https://alfajores-forno.celo-testnet.org`
   - Check https://chainlist.org for more

2. Update `.env` file with working RPC

### Deployment Fails

- Ensure wallet has Celo Sepolia testnet funds
- Check `forge wallet list` to confirm account is imported
- Try running with more verbose output: `-vvvvv`

### Verification Fails

- Ensure `VITE_POPS_FACTORY_ADDRESS` is set in `web/.env`
- Check browser console for errors
- Verify Pop clone address is correct
- Check verifier logs for detailed error messages
