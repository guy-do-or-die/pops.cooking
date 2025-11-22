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
echo "Deploying and verifying Pops factory contract on Celo Sepolia..."

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

# Extract new contract addresses
# Expected output format: "Pops deployed at: 0x..." and "Pop implementation at: 0x..."
NEW_ADDRESS=$(grep "Pops deployed at:" $OUTPUT_FILE | awk '{print $4}')
POP_IMPL_ADDRESS=$(grep "Pop implementation at:" $OUTPUT_FILE | awk '{print $4}')

if [ -n "$NEW_ADDRESS" ]; then
    echo "New Pops Factory Address: $NEW_ADDRESS"
    echo "New Pop Implementation Address: $POP_IMPL_ADDRESS"
    
    # Update contracts/.env
    if grep -q "POPS_CONTRACT_ADDRESS=" .env; then
        sed -i "s/POPS_CONTRACT_ADDRESS=.*/POPS_CONTRACT_ADDRESS=$NEW_ADDRESS/" .env
    else
        echo "POPS_CONTRACT_ADDRESS=$NEW_ADDRESS" >> .env
    fi
    
    if grep -q "POP_IMPLEMENTATION_ADDRESS=" .env; then
        sed -i "s/POP_IMPLEMENTATION_ADDRESS=.*/POP_IMPLEMENTATION_ADDRESS=$POP_IMPL_ADDRESS/" .env
    else
        echo "POP_IMPLEMENTATION_ADDRESS=$POP_IMPL_ADDRESS" >> .env
    fi
    echo "Updated contracts/.env"

    # Update web/.env
    WEB_ENV="../web/.env"
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

    # Update web/.env.local if it exists (overrides .env)
    WEB_ENV_LOCAL="../web/.env.local"
    if [ -f "$WEB_ENV_LOCAL" ]; then
        if grep -q "VITE_POPS_CONTRACT_ADDRESS=" $WEB_ENV_LOCAL; then
            sed -i "s/VITE_POPS_CONTRACT_ADDRESS=.*/VITE_POPS_CONTRACT_ADDRESS=$NEW_ADDRESS/" $WEB_ENV_LOCAL
        else
            echo "VITE_POPS_CONTRACT_ADDRESS=$NEW_ADDRESS" >> $WEB_ENV_LOCAL
        fi
        echo "Updated $WEB_ENV_LOCAL"
    fi

    echo "Running verification script..."

    sleep 30

    ./verify.sh
else
    echo "Could not extract contract address from output."
fi

rm $OUTPUT_FILE
