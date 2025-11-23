import { Synapse, RPC_URLS } from '@filoz/synapse-sdk';

async function testUpload() {
  try {
    console.log('[TEST] Initializing Synapse...');
    const synapse = await Synapse.create({
      privateKey: '0x5a50cc300a991cbdc5b77fee55215371a590e3da0f8c997df8b5f1c883ce2cc5',
      rpcURL: RPC_URLS.calibration.http,
    });
    
    console.log('[TEST] Wallet:', synapse.getSigner().address);
    console.log('[TEST] Creating storage context...');
    
    const context = await synapse.storage.createContext({
      providerId: 3, // ezpdpz-calib
      callbacks: {
        onProviderSelected: (provider) => {
          console.log('[TEST] ✅ Provider selected:', provider.name);
          console.log('[TEST] Provider URL:', provider.products.PDP?.data.serviceURL);
        },
        onDataSetResolved: (info) => {
          console.log('[TEST] ✅ Data set resolved:', info);
        }
      }
    });
    
    console.log('[TEST] Context created, data set ID:', context.dataSetId);
    
    // Create test data (must be >= 127 bytes)
    const data = new TextEncoder().encode('x'.repeat(200));
    
    console.log('[TEST] Attempting upload...');
    const result = await context.upload(data, {
      metadata: { test: 'true' },
      onUploadComplete: (piece) => {
        console.log('[TEST] ✅ Upload complete:', piece.toString());
      },
      onPieceAdded: (hash) => {
        console.log('[TEST] ✅ Piece added, tx:', hash);
      },
      onPieceConfirmed: (ids) => {
        console.log('[TEST] ✅ Piece confirmed, IDs:', ids);
      }
    });
    
    console.log('[TEST] ========================================');
    console.log('[TEST] ✅ SUCCESS!');
    console.log('[TEST] PieceCID:', result.pieceCid.toString());
    console.log('[TEST] Size:', result.size);
    console.log('[TEST] Piece ID:', result.pieceId);
    console.log('[TEST] ========================================');
    
    process.exit(0);
  } catch (error) {
    console.error('[TEST] ========================================');
    console.error('[TEST] ❌ FAILED');
    console.error('[TEST] Error:', error.message);
    console.error('[TEST] Stack:', error.stack);
    if (error.cause) {
      console.error('[TEST] Cause:', error.cause);
    }
    console.error('[TEST] ========================================');
    process.exit(1);
  }
}

testUpload();
