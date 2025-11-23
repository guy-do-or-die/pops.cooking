import dotenv from 'dotenv';
import { Synapse, RPC_URLS } from '@filoz/synapse-sdk';
import { ethers } from 'ethers';

dotenv.config();

async function deposit() {
  try {
    const privateKey = process.env.FILECOIN_PRIVATE_KEY;
    
    if (!privateKey) {
      console.error('FILECOIN_PRIVATE_KEY not set in .env');
      process.exit(1);
    }
    
    console.log('[DEPOSIT] Initializing Synapse SDK...');
    const synapse = await Synapse.create({
      privateKey: privateKey,
      rpcURL: RPC_URLS.calibration.http,
    });
    
    const wallet = new ethers.Wallet(privateKey);
    console.log('[DEPOSIT] Wallet:', wallet.address);
    console.log('[DEPOSIT] Payments available:', synapse.payments !== undefined);
    
    // Deposit amount in USDFC (suggest 10 USDFC for testing)
    const depositAmount = process.argv[2] || '10';
    console.log(`[DEPOSIT] Depositing ${depositAmount} USDFC to payments contract...`);
    
    // Convert to wei (USDFC has 18 decimals)
    const amountWei = ethers.parseUnits(depositAmount, 18);
    
    const tx = await synapse.payments.deposit(amountWei);
    console.log('[DEPOSIT] Transaction sent:', tx.hash);
    console.log('[DEPOSIT] Waiting for confirmation...');
    
    await tx.wait();
    console.log('[DEPOSIT] ✅ Deposit successful!');
    console.log('[DEPOSIT] You can now use storage uploads');
    
  } catch (error) {
    console.error('[DEPOSIT] ❌ Error:', error.message);
    process.exit(1);
  }
}

deposit();
