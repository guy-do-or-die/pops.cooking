import dotenv from 'dotenv';
import { ethers } from 'ethers';
import { RPC_URLS } from '@filoz/synapse-sdk';

dotenv.config();

const USDFC_CONTRACT = '0xb3042734b608a1B16e9e86B374A3f3e389B4cDf0';

// Common ERC20 + mint functions
const ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function mint(address to, uint256 amount)',
  'function mint(uint256 amount)',
  'function mint()',
  'function claim()',
  'function claimTokens()',
  'function faucet()',
  'function drip()',
  'fallback() payable',
];

async function mintUSDFC() {
  try {
    const privateKey = process.env.FILECOIN_PRIVATE_KEY;
    const provider = new ethers.JsonRpcProvider(RPC_URLS.calibration.http);
    const wallet = new ethers.Wallet(privateKey, provider);
    const usdfc = new ethers.Contract(USDFC_CONTRACT, ABI, wallet);
    
    console.log('[MINT] Wallet:', wallet.address);
    
    const balanceBefore = await usdfc.balanceOf(wallet.address);
    console.log('[MINT] Current USDFC balance:', ethers.formatUnits(balanceBefore, 18));
    
    // Try different mint patterns
    console.log('[MINT] Trying to mint USDFC...');
    
    try {
      // Try: mint()
      console.log('[MINT] Attempting: mint()');
      const tx1 = await usdfc.mint();
      await tx1.wait();
      console.log('[MINT] ✅ mint() succeeded!');
    } catch (e1) {
      console.log('[MINT] mint() failed:', e1.message.split('\n')[0]);
      
      try {
        // Try: mint(amount)
        const amount = ethers.parseUnits('100', 18);
        console.log('[MINT] Attempting: mint(100)');
        const tx2 = await usdfc.mint(amount);
        await tx2.wait();
        console.log('[MINT] ✅ mint(amount) succeeded!');
      } catch (e2) {
        console.log('[MINT] mint(amount) failed:', e2.message.split('\n')[0]);
        
        try {
          // Try: mint(to, amount)
          const amount = ethers.parseUnits('100', 18);
          console.log('[MINT] Attempting: mint(address, 100)');
          const tx3 = await usdfc.mint(wallet.address, amount);
          await tx3.wait();
          console.log('[MINT] ✅ mint(to, amount) succeeded!');
        } catch (e3) {
          console.log('[MINT] mint(to, amount) failed:', e3.message.split('\n')[0]);
          
          // Try other methods
          try {
            console.log('[MINT] Attempting: faucet()');
            const tx4 = await usdfc.faucet();
            await tx4.wait();
            console.log('[MINT] ✅ faucet() succeeded!');
          } catch (e4) {
            console.log('[MINT] faucet() failed:', e4.message.split('\n')[0]);
            throw new Error('All mint methods failed. You may need to use the web faucet.');
          }
        }
      }
    }
    
    const balanceAfter = await usdfc.balanceOf(wallet.address);
    const received = balanceAfter - balanceBefore;
    
    console.log('[MINT] ========================================');
    console.log('[MINT] ✅ Success!');
    console.log('[MINT]   Received:', ethers.formatUnits(received, 18), 'USDFC');
    console.log('[MINT]   New balance:', ethers.formatUnits(balanceAfter, 18), 'USDFC');
    console.log('[MINT] ========================================');
    
    process.exit(0);
  } catch (error) {
    console.error('[MINT] ❌ Error:', error.message);
    console.error('[MINT]');
    console.error('[MINT] 💡 Use the web faucet instead:');
    console.error('[MINT]    https://forest-explorer.chainsafe.dev/faucet/calibnet_usdfc');
    console.error('[MINT]    Wallet: 0xBe7c44C2550fA8E9329a51Ae89AbfE440f4057A0');
    process.exit(1);
  }
}

mintUSDFC();
