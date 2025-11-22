#!/bin/bash
# Navigate to the script's directory (contracts/) to ensure forge finds foundry.toml
cd "$(dirname "$0")"

# Load environment variables
source .env

# Contract address
CONTRACT_ADDRESS="${POPS_CONTRACT_ADDRESS}"

if [ -z "$CONTRACT_ADDRESS" ]; then
    echo "Error: POPS_CONTRACT_ADDRESS is not set in .env"
    exit 1
fi

if [ -z "$ETHERSCAN_API_KEY" ]; then
    echo "Error: ETHERSCAN_API_KEY is not set in .env"
    exit 1
fi

export ETHERSCAN_API_KEY

echo "Verifying contract at $CONTRACT_ADDRESS..."
echo "Using API Key: $ETHERSCAN_API_KEY"

forge verify-contract \
    --chain-id 11142220 \
    --watch \
    --verifier etherscan \
    --etherscan-api-key "$ETHERSCAN_API_KEY" \
    $CONTRACT_ADDRESS \
    src/Pops.sol:Pops
