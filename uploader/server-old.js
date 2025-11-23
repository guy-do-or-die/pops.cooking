import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import FormData from 'form-data';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = process.env.PORT || 3001;
const WEB3_STORAGE_TOKEN = process.env.WEB3_STORAGE_TOKEN;
app.use(cors());
app.use(express.json());

// Initialize Synapse SDK
let synapse = null;

async function initSynapse() {
  try {
    let wallet;
    
    // Check if running in TEE with attestation capability
    const teeSecret = process.env.TEE_DERIVED_SECRET;
    
    if (teeSecret) {
      // Derive deterministic wallet from TEE attestation
      console.log('[IPFS] Using TEE-derived wallet (secure)');
      wallet = new ethers.Wallet(teeSecret);
    } else {
      // Fallback to explicit private key (dev/testing only)
      const privateKey = process.env.FILECOIN_PRIVATE_KEY;
      
      if (!privateKey || privateKey.includes('your_private_key_here')) {
        console.warn('[IPFS] WARNING: No TEE secret or private key configured');
        console.warn('[IPFS] Uploader will return mock CIDs for testing');
        console.warn('[IPFS] For production: Set TEE_DERIVED_SECRET or FILECOIN_PRIVATE_KEY');
        return;
      }
      
      console.log('[IPFS] Using explicit private key (dev mode)');
      wallet = new ethers.Wallet(privateKey);
    }
    
    synapse = new Synapse({
      wallet,
      network: 'calibration' // Use calibration testnet
    });

    // Convert Ethereum address to Filecoin format (t-address for calibration testnet)
    const filecoinAddress = newDelegatedEthAddress(wallet.address, 't');
    
    console.log('[IPFS] Synapse SDK initialized on Filecoin Calibration');
    console.log('[IPFS] ========================================');
    console.log('[IPFS] ETHEREUM ADDRESS:', wallet.address);
    console.log('[IPFS] FILECOIN ADDRESS:', filecoinAddress.toString());
    console.log('[IPFS] ========================================');
    console.log('[IPFS] Fund the FILECOIN address with:');
    console.log('[IPFS]   - FIL: https://faucet.calibnet.chainsafe-fil.io/funds.html');
    console.log('[IPFS]   - USDFC: https://forest-explorer.chainsafe.dev/faucet/calibnet_usdfc');
    console.log('[IPFS] ========================================');
    
    // Store both addresses for API access
    app.locals.ethAddress = wallet.address;
    app.locals.filecoinAddress = filecoinAddress.toString();
  } catch (error) {
    console.error('[IPFS] Failed to initialize Synapse SDK:', error);
  }
}

// Initialize on startup
initSynapse();

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    synapse_ready: synapse !== null,
    network: 'filecoin-calibration',
    eth_address: req.app.locals.ethAddress || null,
    filecoin_address: req.app.locals.filecoinAddress || null
  });
});

// API endpoint to get wallet address for funding
app.get('/wallet', (req, res) => {
  const ethAddress = req.app.locals.ethAddress;
  const filecoinAddress = req.app.locals.filecoinAddress;
  
  if (!ethAddress || !filecoinAddress) {
    return res.status(503).json({ 
      error: 'Wallet not initialized',
      message: 'Synapse SDK not ready. Check logs for configuration issues.'
    });
  }
  
  res.json({
    eth_address: ethAddress,
    filecoin_address: filecoinAddress,
    network: 'filecoin-calibration',
    faucets: {
      fil: `https://faucet.calibnet.chainsafe-fil.io/send?address=${filecoinAddress}`,
      usdfc: 'https://forest-explorer.chainsafe.dev/faucet/calibnet_usdfc'
    },
    explorer: `https://calibration.filfox.info/en/address/${ethAddress}`,
    instructions: 'Use the filecoin_address (t4...) for faucet funding'
  });
});

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // If Synapse not initialized, return mock CID for testing
    if (!synapse) {
      console.warn('[IPFS] Synapse not initialized, generating mock CID');
      const crypto = await import('crypto');
      const hash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
      
      // Convert hex to base32 for valid CID format
      // CIDv1 base32: bafybei + 52 base32 chars
      const base32chars = 'abcdefghijklmnopqrstuvwxyz234567';
      let base32 = '';
      for (let i = 0; i < 52; i++) {
        const idx = parseInt(hash.substring(i * 2, i * 2 + 2), 16) % 32;
        base32 += base32chars[idx];
      }
      const mockCid = `bafybei${base32}`;
      
      console.log(`[IPFS] Mock CID generated: ${mockCid}`);
      
      return res.json({
        success: true,
        cid: mockCid,
        gateway_url: `https://w3s.link/ipfs/${mockCid}`,
        size: req.file.size,
        mock: true
      });
    }

    console.log(`[IPFS] Uploading ${req.file.size} bytes to Filecoin via Synapse SDK...`);

    // TODO: Complete Synapse SDK integration when API docs are available
    // For now, generate deterministic CID from content
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    
    // Convert to base32 for valid CID format
    // SHA256 produces 64 hex chars (32 bytes, 256 bits)
    // We need 52 base32 chars for proper CID (52 * 5 bits = 260 bits)
    const base32chars = 'abcdefghijklmnopqrstuvwxyz234567';
    let base32 = '';
    
    // Convert each hex pair to base32 char (uses first 32 bytes)
    for (let i = 0; i < 32 && i * 2 < hash.length; i++) {
      const hexPair = hash.substring(i * 2, i * 2 + 2);
      const idx = parseInt(hexPair, 16) % 32;
      base32 += base32chars[idx];
    }
    
    // Extend to 52 chars by repeating pattern from hash
    while (base32.length < 52) {
      const idx = parseInt(hash.substring((base32.length * 2) % hash.length, (base32.length * 2) % hash.length + 2), 16) % 32;
      base32 += base32chars[idx];
    }
    
    const cid = `bafybei${base32}`;
    
    const gatewayUrl = `https://w3s.link/ipfs/${cid}`;
    console.log(`[IPFS] ==========================================`);
    console.log(`[IPFS] Generated MOCK CID: ${cid}`);
    console.warn(`[IPFS] ⚠️  WARNING: This is a MOCK CID`);
    console.warn(`[IPFS] ⚠️  NOT uploaded to IPFS - link will NOT work`);
    console.warn(`[IPFS] ⚠️  Gateway URL (non-functional): ${gatewayUrl}`);
    console.warn(`[IPFS] ⚠️  Real Synapse SDK upload not configured`);
    console.log(`[IPFS] ==========================================`);

    res.json({
      success: true,
      cid: cid,
      gateway_url: gatewayUrl,
      size: req.file.size,
      note: 'Mock CID - Synapse SDK integration pending'
    });

  } catch (error) {
    console.error('[IPFS] Upload error:', error);
    res.status(500).json({ 
      error: 'Upload failed',
      message: error.message 
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[IPFS] Uploader service running on port ${PORT}`);
});
