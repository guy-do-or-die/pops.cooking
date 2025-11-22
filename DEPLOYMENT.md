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

## Architecture

- **PopsFactory**: ERC1155 token contract + clone factory
- **Pop**: Cloneable contract (one per token)
  - Stores challenges
  - Stores progress history
  - Only token owner can generate challenges
- **Verifier**: Reads from Pop clones, validates recordings

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
