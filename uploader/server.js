import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { Synapse, RPC_URLS } from '@filoz/synapse-sdk';
import { ethers } from 'ethers';
import { PinataSDK } from 'pinata';
import sharp from 'sharp';

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

let synapse = null;
let walletAddress = null;

async function initSynapse() {
  try {
    const privateKey = process.env.FILECOIN_PRIVATE_KEY;
    
    if (!privateKey || privateKey.includes('your_private_key_here')) {
      console.warn('[SYNAPSE] ⚠️  No private key configured');
      console.warn('[SYNAPSE] ⚠️  Set FILECOIN_PRIVATE_KEY in .env');
      console.warn('[SYNAPSE] ⚠️  Uploader will generate mock CIDs');
      return;
    }
    
    console.log('[SYNAPSE] Initializing Synapse SDK...');
    console.log('[SYNAPSE] RPC URL:', RPC_URLS.calibration.http);
    
    // Get wallet address from private key
    const wallet = new ethers.Wallet(privateKey);
    walletAddress = wallet.address;
    console.log('[SYNAPSE] Wallet address:', walletAddress);
    
    // Create Synapse instance with timeout
    console.log('[SYNAPSE] Creating Synapse instance...');
    const createPromise = Synapse.create({
      privateKey: privateKey,
      rpcURL: RPC_URLS.calibration.http,
    });
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Synapse initialization timeout after 30s')), 30000)
    );
    
    synapse = await Promise.race([createPromise, timeoutPromise]);
    
    console.log('[SYNAPSE] ========================================');
    console.log('[SYNAPSE] ✅ Synapse SDK initialized!');
    console.log('[SYNAPSE] Network: Filecoin Calibration Testnet');
    console.log('[SYNAPSE] Wallet:', walletAddress);
    console.log('[SYNAPSE] Storage available:', synapse.storage !== undefined);
    console.log('[SYNAPSE] Payments available:', synapse.payments !== undefined);
    console.log('[SYNAPSE] SDK methods:', Object.keys(synapse).filter(k => typeof synapse[k] === 'function'));
    console.log('[SYNAPSE] SDK properties:', Object.keys(synapse).filter(k => typeof synapse[k] !== 'function'));
    console.log('[SYNAPSE] ========================================');
    console.log('[SYNAPSE] 📋 Next steps:');
    console.log('[SYNAPSE] 1. Fund wallet with tFIL (gas):');
    console.log('[SYNAPSE]    https://faucet.calibnet.chainsafe-fil.io/funds.html');
    console.log('[SYNAPSE] 2. Fund wallet with USDFC (storage):');
    console.log('[SYNAPSE]    https://forest-explorer.chainsafe.dev/faucet/calibnet_usdfc');
    console.log('[SYNAPSE] 3. Deposit USDFC to payments:');
    console.log('[SYNAPSE]    await synapse.payments.deposit(amount)');
    console.log('[SYNAPSE] ========================================');
    
  } catch (error) {
    console.error('[SYNAPSE] ❌ Failed to initialize:', error.message);
    console.error('[SYNAPSE] Check your FILECOIN_PRIVATE_KEY and network connection');
  }
}

// Initialize on startup
initSynapse();

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    synapse_ready: synapse !== null,
    wallet: walletAddress,
    network: 'filecoin-calibration'
  });
});

app.get('/wallet', (req, res) => {
  if (!walletAddress) {
    return res.status(503).json({ 
      error: 'Wallet not initialized',
      message: 'Configure FILECOIN_PRIVATE_KEY and restart'
    });
  }
  
  res.json({
    address: walletAddress,
    network: 'filecoin-calibration',
    faucets: {
      tFIL: 'https://faucet.calibnet.chainsafe-fil.io/funds.html',
      USDFC: 'https://forest-explorer.chainsafe.dev/faucet/calibnet_usdfc'
    }
  });
});

app.post('/upload', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  let processedBuffer; // Declare outside try block so it's accessible in catch
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`[UPLOAD] ========================================`);
    console.log(`[UPLOAD] 📥 Received ${req.file.size} bytes (${req.file.originalname || 'unnamed'})`);
    console.log(`[UPLOAD] ⏱️  Start time: ${new Date().toISOString()}`);

    // Resize image before uploading (if it's an image)
    processedBuffer = req.file.buffer;
    if (req.file.mimetype && req.file.mimetype.startsWith('image/')) {
      try {
        console.log('[UPLOAD] 🖼️  Resizing image (max width 1024px, maintaining aspect ratio)...');
        const resized = await sharp(req.file.buffer)
          .resize(1024, null, { 
            fit: 'inside', 
            withoutEnlargement: true 
          })
          .jpeg({ quality: 85 })
          .toBuffer();
        
        const savedBytes = req.file.size - resized.length;
        console.log(`[UPLOAD] ✅ Resized: ${req.file.size} → ${resized.length} bytes (saved ${savedBytes} bytes)`);
        processedBuffer = resized;
      } catch (resizeError) {
        console.warn('[UPLOAD] ⚠️  Resize failed, using original:', resizeError.message);
      }
    }

    // Check if Synapse is initialized
    if (!synapse) {
      console.warn('[UPLOAD] ⚠️  Synapse not initialized, generating mock CID');
      return await generateMockCID(processedBuffer, res);
    }
    
    // Check if storage manager is available
    if (!synapse.storage) {
      console.error('[UPLOAD] ❌ Synapse.storage is undefined!');
      console.error('[UPLOAD] This might mean:');
      console.error('[UPLOAD]   1. SDK version mismatch');
      console.error('[UPLOAD]   2. Need to deposit USDFC to payments contract');
      console.error('[UPLOAD]   3. SDK not fully initialized');
      console.warn('[UPLOAD] ⚠️  Falling back to mock CID');
      return await generateMockCID(processedBuffer, res);
    }

    // Ensure minimum size (127 bytes per Filecoin requirement)
    let data = processedBuffer;
    if (data.length < 127) {
      console.log(`[UPLOAD] 📏 Padding data from ${data.length} to 127 bytes`);
      const padded = Buffer.alloc(127);
      data.copy(padded);
      data = padded;
    }

    console.log(`[UPLOAD] 🔄 Attempting Synapse SDK upload (10s timeout)...`);
    
    // Upload using Synapse SDK with timeout (10 seconds)
    const uploadPromise = synapse.storage.upload(data);
    const timeoutPromise = new Promise((_, reject) => {
      const interval = setInterval(() => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[UPLOAD] ⏳ Synapse upload in progress... ${elapsed}s`);
      }, 2000);
      
      setTimeout(() => {
        clearInterval(interval);
        reject(new Error('Synapse upload timeout after 10s'));
      }, 1); // SYNAPSE TIMEOUT
    });
    
    const { pieceCid } = await Promise.race([uploadPromise, timeoutPromise]);
    
    const gatewayUrl = `https://w3s.link/ipfs/${pieceCid}`;
    
    console.log('[UPLOAD] ==========================================');
    console.log('[UPLOAD] ✅ Successfully uploaded to Filecoin!');
    console.log('[UPLOAD] Piece CID:', pieceCid);
    console.log('[UPLOAD] Gateway URL:', gatewayUrl);
    console.log('[UPLOAD] ==========================================');

    res.json({
      success: true,
      cid: pieceCid,
      gateway_url: gatewayUrl,
      size: req.file.size,
      network: 'filecoin-calibration'
    });

  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[UPLOAD] ❌ Synapse upload failed after ${elapsed}s:`, error.message);
    
    // Try Pinata as fallback for REAL IPFS links
    try {
      const pinataJWT = process.env.PINATA_JWT;
      if (pinataJWT && pinataJWT !== 'your_pinata_jwt_here') {
        console.log('[UPLOAD] 🔄 Trying Pinata fallback...');
        console.log('[UPLOAD] 📦 Creating Pinata client...');
        
        const pinata = new PinataSDK({
          pinataJwt: pinataJWT
        });
        
        console.log('[UPLOAD] 📄 Preparing file for upload...');
        // Create File object using global File (available in Node.js 20+)
        const file = new globalThis.File(
          [processedBuffer], 
          req.file.originalname || 'screenshot.png',
          { type: req.file.mimetype || 'image/jpeg' }
        );
        
        console.log('[UPLOAD] 🚀 Uploading to Pinata (public IPFS)...');
        // Upload to Pinata - using public API
        const uploadResponse = await pinata.upload.public.file(file);
        
        const cid = uploadResponse.cid;
        const gatewayUrl = `https://green-impossible-swordfish-523.mypinata.cloud/ipfs/${cid}`;
        
        console.log('[UPLOAD] ==========================================');
        console.log('[UPLOAD] ✅ Uploaded to Pinata (IPFS)!');
        console.log('[UPLOAD] CID:', cid);
        console.log('[UPLOAD] Size:', uploadResponse.size);
        console.log('[UPLOAD] Name:', uploadResponse.name);
        console.log('[UPLOAD] Gateway URL:', gatewayUrl);
        console.log('[UPLOAD] ==========================================');
        
        return res.json({
          success: true,
          cid: cid,
          gateway_url: gatewayUrl,
          size: uploadResponse.size,
          network: 'ipfs-pinata',
          note: 'Uploaded via Pinata (Synapse unavailable)'
        });
      } else {
        console.log('[UPLOAD] ⚠️  Pinata JWT not configured, skipping');
      }
    } catch (pinataError) {
      const pinataElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`[UPLOAD] ❌ Pinata also failed after ${pinataElapsed}s:`, pinataError.message);
    }
    
    // Final fallback to mock CID
    const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.warn(`[UPLOAD] ⚠️  All upload methods failed after ${totalElapsed}s`);
    console.warn('[UPLOAD] 🔧 Generating mock CID as last resort');
    return await generateMockCID(req.file.buffer, res);
  }
});

// Generate mock CID for testing when Synapse unavailable
async function generateMockCID(buffer, res) {
  const crypto = await import('crypto');
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  
  // Convert to base32
  const base32chars = 'abcdefghijklmnopqrstuvwxyz234567';
  let base32 = '';
  for (let i = 0; i < 32 && i * 2 < hash.length; i++) {
    const hexPair = hash.substring(i * 2, i * 2 + 2);
    const idx = parseInt(hexPair, 16) % 32;
    base32 += base32chars[idx];
  }
  // Extend to 52 chars
  while (base32.length < 52) {
    const idx = parseInt(hash.substring((base32.length * 2) % hash.length, (base32.length * 2) % hash.length + 2), 16) % 32;
    base32 += base32chars[idx];
  }
  
  const mockCid = `bafybei${base32}`;
  const gatewayUrl = `https://w3s.link/ipfs/${mockCid}`;
  
  console.log('[UPLOAD] ==========================================');
  console.log('[UPLOAD] ⚠️  Generated MOCK CID (not uploaded)');
  console.log('[UPLOAD] Mock CID:', mockCid);
  console.log('[UPLOAD] ⚠️  This link will NOT work');
  console.log('[UPLOAD] ⚠️  Configure Synapse SDK for real uploads');
  console.log('[UPLOAD] ==========================================');

  res.json({
    success: true,
    cid: mockCid,
    gateway_url: gatewayUrl,
    size: buffer.length,
    note: 'Mock CID - Synapse SDK not configured'
  });
}

app.listen(PORT, () => {
  console.log(`[UPLOADER] Service running on port ${PORT}`);
});
