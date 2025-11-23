import dotenv from 'dotenv';
import { ethers } from 'ethers';
import { RPC_URLS } from '@filoz/synapse-sdk';

dotenv.config();

const USDFC_PROXY = '0xb3042734b608a1B16e9e86B374A3f3e389B4cDf0';

// Standard proxy storage slot for implementation address
const IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

async function checkUSDFC() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URLS.calibration.http);
    
    console.log('[CHECK] Getting implementation address...');
    const implAddress = await provider.getStorage(USDFC_PROXY, IMPLEMENTATION_SLOT);
    const implementation = '0x' + implAddress.slice(-40);
    
    console.log('[CHECK] Proxy:', USDFC_PROXY);
    console.log('[CHECK] Implementation:', implementation);
    
    // Try to get the implementation contract code
    const code = await provider.getCode(implementation);
    console.log('[CHECK] Implementation has code:', code.length > 2);
    
    // Try calling common faucet/mint functions through the proxy
    const wallet = new ethers.Wallet(process.env.FILECOIN_PRIVATE_KEY, provider);
    
    // USDFC on Calibration typically has a drip() function for faucet
    const usdfc = new ethers.Contract(
      USDFC_PROXY,
      [
        'function balanceOf(address) view returns (uint256)',
        'function drip()',
        'function mint()',
        'function faucet()',
        'function claim()',
      ],
      wallet
    );
    
    const balanceBefore = await usdfc.balanceOf(wallet.address);
    console.log('[CHECK] Current balance:', ethers.formatUnits(balanceBefore, 18), 'USDFC');
    
    console.log('[CHECK] Trying drip()...');
    try {
      const tx = await usdfc.drip();
      console.log('[CHECK] Transaction sent:', tx.hash);
      await tx.wait();
      
      const balanceAfter = await usdfc.balanceOf(wallet.address);
      const received = balanceAfter - balanceBefore;
      
      console.log('[CHECK] ✅ Success!');
      console.log('[CHECK]   Received:', ethers.formatUnits(received, 18), 'USDFC');
      console.log('[CHECK]   New balance:', ethers.formatUnits(balanceAfter, 18), 'USDFC');
      
      process.exit(0);
    } catch (e) {
      console.log('[CHECK] drip() failed:', e.message.split('\n')[0]);
      console.log('[CHECK]');
      console.log('[CHECK] 💡 The contract may have rate limits or require using the web faucet');
      console.log('[CHECK]    https://forest-explorer.chainsafe.dev/faucet/calibnet_usdfc');
      console.log('[CHECK]    Your wallet: 0xBe7c44C2550fA8E9329a51Ae89AbfE440f4057A0');
      process.exit(1);
    }
  } catch (error) {
    console.error('[CHECK] ❌ Error:', error.message);
    process.exit(1);
  }
}

checkUSDFC();
