import dotenv from 'dotenv';
import { ethers } from 'ethers';
import { RPC_URLS } from '@filoz/synapse-sdk';

dotenv.config();

const USDFC_CONTRACT = '0xb3042734b608a1B16e9e86B374A3f3e389B4cDf0';

async function getUSDFC() {
  try {
    const privateKey = process.env.FILECOIN_PRIVATE_KEY;
    const provider = new ethers.JsonRpcProvider(RPC_URLS.calibration.http);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log('[SWAP] Wallet:', wallet.address);
    
    // Check balances before
    const filBalance = await provider.getBalance(wallet.address);
    const usdfc = new ethers.Contract(
      USDFC_CONTRACT,
      ['function balanceOf(address) view returns (uint256)'],
      wallet
    );
    const usdcfBalanceBefore = await usdfc.balanceOf(wallet.address);
    
    console.log('[SWAP] ========================================');
    console.log('[SWAP] Current balances:');
    console.log('[SWAP]   tFIL:', ethers.formatEther(filBalance));
    console.log('[SWAP]   USDFC:', ethers.formatUnits(usdcfBalanceBefore, 18));
    console.log('[SWAP] ========================================');
    
    // Send 5 tFIL to USDFC contract to mint tokens
    const amountToSend = ethers.parseEther('5'); // 5 tFIL
    
    if (filBalance < amountToSend) {
      throw new Error(`Insufficient tFIL balance. Have ${ethers.formatEther(filBalance)}, need 5`);
    }
    
    console.log('[SWAP] Sending 5 tFIL to USDFC contract to mint tokens...');
    const tx = await wallet.sendTransaction({
      to: USDFC_CONTRACT,
      value: amountToSend,
    });
    
    console.log('[SWAP] Transaction sent:', tx.hash);
    console.log('[SWAP] Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log('[SWAP] ✅ Transaction confirmed in block', receipt.blockNumber);
    
    // Check balance after
    const usdcfBalanceAfter = await usdfc.balanceOf(wallet.address);
    const received = usdcfBalanceAfter - usdcfBalanceBefore;
    
    console.log('[SWAP] ========================================');
    console.log('[SWAP] ✅ Success!');
    console.log('[SWAP]   Sent:', ethers.formatEther(amountToSend), 'tFIL');
    console.log('[SWAP]   Received:', ethers.formatUnits(received, 18), 'USDFC');
    console.log('[SWAP]   New USDFC balance:', ethers.formatUnits(usdcfBalanceAfter, 18));
    console.log('[SWAP] ========================================');
    console.log('[SWAP] 🎉 You can now run: node init-account.js');
    
    process.exit(0);
  } catch (error) {
    console.error('[SWAP] ❌ Error:', error.message);
    if (error.data) console.error('[SWAP] Data:', error.data);
    process.exit(1);
  }
}

getUSDFC();
