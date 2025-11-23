import { ethers } from 'ethers';

// Generate a new random wallet
const wallet = ethers.Wallet.createRandom();

console.log('========================================');
console.log('🔑 NEW WALLET GENERATED');
console.log('========================================');
console.log('Address:', wallet.address);
console.log('Private Key:', wallet.privateKey);
console.log('========================================');
console.log('');
console.log('📋 INSTRUCTIONS:');
console.log('1. Get USDFC for this address from faucet:');
console.log('   https://forest-explorer.chainsafe.dev/faucet/calibnet_usdfc');
console.log('');
console.log('2. Save the private key to transfer.env:');
console.log(`   echo "TEMP_WALLET_KEY=${wallet.privateKey}" > transfer.env`);
console.log('');
console.log('3. Run the transfer script:');
console.log('   node transfer-usdfc.js');
console.log('========================================');
