#!/bin/bash
# Navigate to the script's directory (contracts/) to ensure forge finds foundry.toml
cd "$(dirname "$0")"

# Load environment variables
source .env

# Contract addresses
POPS_ADDRESS="${POPS_CONTRACT_ADDRESS}"
POP_IMPL_ADDRESS="${POP_IMPLEMENTATION_ADDRESS}"

if [ -z "$POPS_ADDRESS" ]; then
    echo "Error: POPS_CONTRACT_ADDRESS is not set in .env"
    exit 1
fi

if [ -z "$POP_IMPL_ADDRESS" ]; then
    echo "Error: POP_IMPLEMENTATION_ADDRESS is not set in .env"
    exit 1
fi

if [ -z "$ETHERSCAN_API_KEY" ]; then
    echo "Error: ETHERSCAN_API_KEY is not set in .env"
    exit 1
fi

export ETHERSCAN_API_KEY

echo "Verifying Pops factory at $POPS_ADDRESS..."
echo "Using API Key: $ETHERSCAN_API_KEY"

forge verify-contract \
    --chain-id 11142220 \
    --watch \
    --verifier etherscan \
    --etherscan-api-key "$ETHERSCAN_API_KEY" \
    --constructor-args $(cast abi-encode "constructor(string)" "https://pops.cooking/api/metadata/") \
    $POPS_ADDRESS \
    src/Pops.sol:Pops

echo ""
echo "Verifying Pop implementation at $POP_IMPL_ADDRESS..."

forge verify-contract \
    --chain-id 11142220 \
    --watch \
    --verifier etherscan \
    --etherscan-api-key "$ETHERSCAN_API_KEY" \
    $POP_IMPL_ADDRESS \
    src/Pop.sol:Pop
