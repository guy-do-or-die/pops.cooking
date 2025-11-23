import { Synapse, RPC_URLS } from '@filoz/synapse-sdk';

async function checkProviders() {
  try {
    console.log('[CHECK] Initializing Synapse...');
    const synapse = await Synapse.create({
      privateKey: '0x5a50cc300a991cbdc5b77fee55215371a590e3da0f8c997df8b5f1c883ce2cc5',
      rpcURL: RPC_URLS.calibration.http,
    });
    
    console.log('[CHECK] Getting storage info...');
    const info = await synapse.getStorageInfo();
    
    console.log('[CHECK] ========================================');
    console.log('[CHECK] Available Providers:');
    console.log('[CHECK] ========================================');
    
    for (const p of info.providers) {
      console.log(`[CHECK] Provider ID: ${p.id}`);
      console.log(`[CHECK]   Name: ${p.name}`);
      console.log(`[CHECK]   Active: ${p.active}`);
      console.log(`[CHECK]   Service Provider: ${p.serviceProvider}`);
      console.log(`[CHECK]   PDP URL: ${p.products.PDP?.data.serviceURL || 'N/A'}`);
      
      // Try to ping the provider
      if (p.products.PDP?.data.serviceURL) {
        try {
          const response = await fetch(`${p.products.PDP.data.serviceURL}/pdp/health`);
          console.log(`[CHECK]   Health Check: ${response.ok ? '✅ OK' : '❌ Failed'}`);
        } catch (e) {
          console.log(`[CHECK]   Health Check: ❌ Error - ${e.message}`);
        }
      }
      console.log('');
    }
    
    console.log('[CHECK] ========================================');
    console.log('[CHECK] Pricing:');
    console.log(`[CHECK]   Storage: ${info.pricing.noCDN.perTiBPerMonth} per TiB/month`);
    console.log(`[CHECK]   CDN Egress: ${info.pricing.withCDN.cdnEgress} per TiB`);
    console.log('[CHECK] ========================================');
    
    process.exit(0);
  } catch (error) {
    console.error('[CHECK] ❌ Error:', error.message);
    process.exit(1);
  }
}

checkProviders();
