import { ethers } from 'ethers';
import { RPC_URLS } from '@filoz/synapse-sdk';
import fs from 'fs';

const USDFC_CONTRACT = '0xb3042734b608a1B16e9e86B374A3f3e389B4cDf0';
const TARGET_ADDRESS = '0xBe7c44C2550fA8E9329a51Ae89AbfE440f4057A0';

async function transferUSDFC() {
  try {
    // Read the temp wallet key from transfer.env
    const envContent = fs.readFileSync('transfer.env', 'utf-8');
    const match = envContent.match(/TEMP_WALLET_KEY=(0x[a-fA-F0-9]+)/);
    
    if (!match) {
      throw new Error('TEMP_WALLET_KEY not found in transfer.env');
    }
    
    const tempPrivateKey = match[1];
    const provider = new ethers.JsonRpcProvider(RPC_URLS.calibration.http);
    const tempWallet = new ethers.Wallet(tempPrivateKey, provider);
    
    console.log('[TRANSFER] From wallet:', tempWallet.address);
    console.log('[TRANSFER] To wallet:', TARGET_ADDRESS);
    
    // Create USDFC contract instance
    const usdfc = new ethers.Contract(
      USDFC_CONTRACT,
      [
        'function balanceOf(address) view returns (uint256)',
        'function transfer(address to, uint256 amount) returns (bool)',
      ],
      tempWallet
    );
    
    // Check balance
    const balance = await usdfc.balanceOf(tempWallet.address);
    console.log('[TRANSFER] Temp wallet USDFC balance:', ethers.formatUnits(balance, 18));
    
    if (balance === 0n) {
      throw new Error('Temp wallet has no USDFC. Get some from the faucet first.');
    }
    
    // Check FIL balance for gas
    const filBalance = await provider.getBalance(tempWallet.address);
    console.log('[TRANSFER] Temp wallet tFIL balance:', ethers.formatEther(filBalance));
    
    if (filBalance < ethers.parseEther('0.01')) {
      console.log('[TRANSFER] ⚠️  Low FIL balance. You may need to send some tFIL for gas.');
      console.log('[TRANSFER] ⚠️  Trying anyway...');
    }
    
    // Transfer all USDFC to target address
    console.log('[TRANSFER] Transferring', ethers.formatUnits(balance, 18), 'USDFC...');
    const tx = await usdfc.transfer(TARGET_ADDRESS, balance);
    
    console.log('[TRANSFER] Transaction sent:', tx.hash);
    console.log('[TRANSFER] Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log('[TRANSFER] ✅ Transaction confirmed in block', receipt.blockNumber);
    
    // Verify
    const targetBalance = await usdfc.balanceOf(TARGET_ADDRESS);
    console.log('[TRANSFER] ========================================');
    console.log('[TRANSFER] ✅ Success!');
    console.log('[TRANSFER]   Transferred:', ethers.formatUnits(balance, 18), 'USDFC');
    console.log('[TRANSFER]   Target balance:', ethers.formatUnits(targetBalance, 18), 'USDFC');
    console.log('[TRANSFER] ========================================');
    console.log('[TRANSFER] 🎉 Now run: node init-account.js');
    
    process.exit(0);
  } catch (error) {
    console.error('[TRANSFER] ❌ Error:', error.message);
    process.exit(1);
  }
}

transferUSDFC();
