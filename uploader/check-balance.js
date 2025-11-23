import dotenv from 'dotenv';
import { Synapse, RPC_URLS } from '@filoz/synapse-sdk';
import { ethers } from 'ethers';

dotenv.config();

async function checkBalance() {
  try {
    const privateKey = process.env.FILECOIN_PRIVATE_KEY;
    
    console.log('[CHECK] Initializing Synapse SDK...');
    const synapse = await Synapse.create({
      privateKey: privateKey,
      rpcURL: RPC_URLS.calibration.http,
    });
    
    const wallet = new ethers.Wallet(privateKey);
    console.log('[CHECK] Wallet:', wallet.address);
    console.log('[CHECK] Storage available:', synapse.storage !== undefined);
    console.log('[CHECK] Payments available:', synapse.payments !== undefined);
    
    if (synapse.payments) {
      console.log('[CHECK] Getting balance...');
      const balance = await synapse.payments.getBalance();
      console.log('[CHECK] ✅ Payment balance:', ethers.formatUnits(balance, 18), 'USDFC');
    }
    
    if (synapse.storage) {
      console.log('[CHECK] ✅ Storage manager is available!');
    } else {
      console.log('[CHECK] ⚠️  Storage manager still not available');
      console.log('[CHECK] This might be an SDK version issue');
    }
    
  } catch (error) {
    console.error('[CHECK] Error:', error.message);
  }
}

checkBalance();
