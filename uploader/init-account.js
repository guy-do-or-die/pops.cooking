import dotenv from 'dotenv';
import { Synapse, RPC_URLS, TIME_CONSTANTS } from '@filoz/synapse-sdk';
import { ethers } from 'ethers';

dotenv.config();

async function initAccount() {
  try {
    const privateKey = process.env.FILECOIN_PRIVATE_KEY;
    
    console.log('[INIT] Creating Synapse instance...');
    const synapse = await Synapse.create({
      privateKey: privateKey,
      rpcURL: RPC_URLS.calibration.http,
    });
    
    const wallet = new ethers.Wallet(privateKey);
    console.log('[INIT] Wallet:', wallet.address);
    
    const warmStorageAddress = synapse.getWarmStorageAddress();
    console.log('[INIT] WarmStorage address:', warmStorageAddress);
    
    // Deposit 2.5 USDFC and approve in one transaction
    // This covers ~1TiB of storage for 30 days
    const depositAmount = ethers.parseUnits('2.5', 18);
    
    console.log('[INIT] Depositing 2.5 USDFC and approving WarmStorage operator...');
    console.log('[INIT] This single transaction will:');
    console.log('[INIT]   1. Deposit 2.5 USDFC to your payments account');
    console.log('[INIT]   2. Approve WarmStorage to create payment rails');
    console.log('[INIT]   3. Set rate and lockup allowances');
    
    const tx = await synapse.payments.depositWithPermitAndApproveOperator(
      depositAmount,
      warmStorageAddress,
      ethers.MaxUint256, // Rate allowance: unlimited (safe for audited service)
      ethers.MaxUint256, // Lockup allowance: unlimited (safe for audited service)
      TIME_CONSTANTS.EPOCHS_PER_MONTH // Max lockup period: 30 days
    );
    
    console.log('[INIT] Transaction sent:', tx.hash);
    console.log('[INIT] Waiting for confirmation...');
    
    await tx.wait();
    
    console.log('[INIT] ✅ Account initialized successfully!');
    console.log('[INIT] ✅ You can now upload files to Filecoin');
    
    // Verify setup
    const approval = await synapse.payments.serviceApproval(warmStorageAddress);
    console.log('[INIT] ========================================');
    console.log('[INIT] Verification:');
    console.log('[INIT]   Approved:', approval.isApproved);
    console.log('[INIT]   Rate allowance:', approval.rateAllowance.toString());
    console.log('[INIT]   Lockup allowance:', approval.lockupAllowance.toString());
    console.log('[INIT] ========================================');
    
    process.exit(0);
  } catch (error) {
    console.error('[INIT] ❌ Error:', error.message);
    if (error.cause) console.error('[INIT] Cause:', error.cause);
    process.exit(1);
  }
}

initAccount();
