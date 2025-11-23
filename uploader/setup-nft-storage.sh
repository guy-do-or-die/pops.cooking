#!/bin/bash

echo "=========================================="
echo "NFT.Storage Setup for Real IPFS Uploads"
echo "=========================================="
echo ""
echo "📋 Instructions:"
echo ""
echo "1. Opening NFT.Storage in your browser..."
echo "   (If it doesn't open, go to: https://nft.storage)"
echo ""
echo "2. Click 'Start Storing' or 'Sign In'"
echo "3. Sign in with email or GitHub"
echo "4. Go to 'API Keys' in the dashboard"
echo "5. Create a new key (name it 'pops-demo')"
echo "6. Copy the API key"
echo ""

# Try to open browser
if command -v xdg-open > /dev/null; then
    xdg-open "https://nft.storage" 2>/dev/null &
elif command -v open > /dev/null; then
    open "https://nft.storage" 2>/dev/null &
else
    echo "⚠️  Could not open browser automatically"
fi

echo ""
echo "✋ Once you have your API key, paste it below:"
read -p "NFT_STORAGE_KEY: " api_key

if [ -z "$api_key" ]; then
    echo "❌ No key provided. Exiting."
    exit 1
fi

# Update .env file
if [ -f ".env" ]; then
    # Check if NFT_STORAGE_KEY already exists
    if grep -q "NFT_STORAGE_KEY=" .env; then
        # Replace existing key
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|NFT_STORAGE_KEY=.*|NFT_STORAGE_KEY=$api_key|g" .env
        else
            sed -i "s|NFT_STORAGE_KEY=.*|NFT_STORAGE_KEY=$api_key|g" .env
        fi
        echo "✅ Updated NFT_STORAGE_KEY in .env"
    else
        # Add new key
        echo "" >> .env
        echo "# NFT.Storage fallback for real IPFS uploads" >> .env
        echo "NFT_STORAGE_KEY=$api_key" >> .env
        echo "✅ Added NFT_STORAGE_KEY to .env"
    fi
else
    echo "❌ .env file not found!"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ NFT.Storage configured successfully!"
echo "=========================================="
echo ""
echo "Now restart the uploader service:"
echo "  pkill -f 'node server.js'"
echo "  cd uploader && node server.js > /tmp/uploader.log 2>&1 &"
echo ""
echo "Your screenshots will now upload to IPFS! 🎉"
