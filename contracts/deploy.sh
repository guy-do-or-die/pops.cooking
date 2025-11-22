#!/bin/bash

# Load environment variables
source .env

# Check if required variables are set
if [ -z "$RPC_URL" ]; then
    echo "Error: RPC_URL is not set in .env"
    exit 1
fi

if [ -z "$ETHERSCAN_API_KEY" ]; then
    echo "Error: ETHERSCAN_API_KEY is not set in .env"
    exit 1
fi

# Run deployment with verification using Foundry's built-in Etherscan flow
echo "Deploying and verifying Pops contract on Celo Sepolia..."

# Run deployment and capture output
OUTPUT_FILE="deployment_output.txt"

forge script script/Deploy.s.sol:DeployPops \
    -vvvvv \
    --rpc-url $RPC_URL \
    --account default \
    --broadcast \
    | tee $OUTPUT_FILE
    #--verify \
    #--verifier etherscan \
    #--etherscan-api-key $ETHERSCAN_API_KEY \

# Extract new contract address
# Expected output format: "0: contract Pops 0x..."
NEW_ADDRESS=$(grep "0: contract Pops" $OUTPUT_FILE | awk '{print $4}')

if [ -n "$NEW_ADDRESS" ]; then
    echo "New Contract Address: $NEW_ADDRESS"
    
    # Update contracts/.env
    if grep -q "POPS_CONTRACT_ADDRESS=" .env; then
        sed -i "s/POPS_CONTRACT_ADDRESS=.*/POPS_CONTRACT_ADDRESS=$NEW_ADDRESS/" .env
    else
        echo "POPS_CONTRACT_ADDRESS=$NEW_ADDRESS" >> .env
    fi
    echo "Updated contracts/.env"

    # Update web/.env.local
    WEB_ENV="../web/.env.local"
    if [ -f "$WEB_ENV" ]; then
        if grep -q "VITE_POPS_CONTRACT_ADDRESS=" $WEB_ENV; then
            sed -i "s/VITE_POPS_CONTRACT_ADDRESS=.*/VITE_POPS_CONTRACT_ADDRESS=$NEW_ADDRESS/" $WEB_ENV
        else
            echo "VITE_POPS_CONTRACT_ADDRESS=$NEW_ADDRESS" >> $WEB_ENV
        fi
        echo "Updated $WEB_ENV"
    else
        echo "Warning: $WEB_ENV not found"
    fi

    echo "Running verification script..."

    sleep 30

    ./verify.sh
else
    echo "Could not extract contract address from output."
fi

rm $OUTPUT_FILE
