import dotenv from 'dotenv';
import { Synapse, RPC_URLS } from '@filoz/synapse-sdk';
import { ethers } from 'ethers';

dotenv.config();

async function checkAndDeposit() {
  try {
    const privateKey = process.env.FILECOIN_PRIVATE_KEY;
    
    console.log('[CHECK] Creating Synapse instance...');
    const synapse = await Synapse.create({
      privateKey: privateKey,
      rpcURL: RPC_URLS.calibration.http,
    });
    
    const wallet = new ethers.Wallet(privateKey);
    console.log('[CHECK] Wallet:', wallet.address);
    
    // Check balance
    console.log('[CHECK] Checking payment balance...');
    const balance = await synapse.payments.getBalance();
    console.log('[CHECK] Current balance:', ethers.formatUnits(balance, 18), 'USDFC');
    
    if (balance === 0n) {
      console.log('[DEPOSIT] Balance is 0, depositing 10 USDFC...');
      const amount = ethers.parseUnits('10', 18);
      const tx = await synapse.payments.deposit(amount);
      console.log('[DEPOSIT] Transaction:', tx.hash);
      await tx.wait();
      console.log('[DEPOSIT] ✅ Deposited 10 USDFC');
    } else {
      console.log('[CHECK] ✅ Balance is sufficient');
    }
    
    // Get storage info
    console.log('[CHECK] Getting storage info...');
    const storageInfo = await synapse.getStorageInfo();
    console.log('[CHECK] Approved providers:', storageInfo.approvedProviders.length);
    console.log('[CHECK] Default provider:', storageInfo.approvedProviders[0]);
    
    process.exit(0);
  } catch (error) {
    console.error('[ERROR]', error.message);
    if (error.cause) console.error('[CAUSE]', error.cause);
    process.exit(1);
  }
}

checkAndDeposit();
