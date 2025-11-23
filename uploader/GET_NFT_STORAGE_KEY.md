# How to Get NFT.Storage API Key

## Step-by-Step Instructions

1. **Go to:** https://nft.storage

2. **Click "Start Storing"** (top right corner)

3. **Sign In:**
   - Option 1: Email (they'll send you a magic link)
   - Option 2: GitHub account

4. **After logging in, go to "API Keys"** tab in the dashboard

5. **Click "+ New Key"** button

6. **Name your key:** `pops-demo` (or any name)

7. **Copy the ENTIRE key** - it should look like:
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkaWQ6ZXRocjoweGY0N...
   ```
   
   ⚠️ **IMPORTANT:** The key should:
   - Start with `eyJ`
   - Be a LONG string (100+ characters)
   - Be a JWT token format

8. **Update your .env file:**
   ```bash
   cd /home/guy_do_or_die/workspace/buenos/pops/uploader
   nano .env
   ```
   
   Replace the NFT_STORAGE_KEY line with:
   ```
   NFT_STORAGE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.YOUR_ACTUAL_KEY_HERE...
   ```

9. **Restart the uploader:**
   ```bash
   pkill -f "node server.js"
   cd /home/guy_do_or_die/workspace/buenos/pops/uploader
   node server.js > /tmp/uploader.log 2>&1 &
   ```

## Alternative: Use web3.storage Instead

If NFT.Storage doesn't work, you can also use web3.storage:

1. Go to: https://web3.storage
2. Sign in with email or GitHub
3. Create an API token
4. The token format is similar (starts with `eyJ`)

## What the Key Should Look Like

✅ **CORRECT format:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkaWQ6ZXRocjoweGY0NzY3QjI1NkU5MDJCNzU4MTcyNzM1NzQ2YzUxNDE4MzYzRjU3RkIiLCJpc3MiOiJuZnQtc3RvcmFnZSIsImlhdCI6MTY5OTUzNzY5NjAwMCwibmFtZSI6InRlc3QifQ.abcdef123456...
```

❌ **WRONG format (what you provided):**
```
460a7d90.b92193f8053a4bba808c4c423a352f07
```

This looks like an API key from a different service (possibly web3.storage console credentials, not the API token).
