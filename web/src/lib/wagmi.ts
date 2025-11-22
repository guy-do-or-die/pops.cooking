import { http, createConfig } from 'wagmi';
import type { Chain } from 'viem';

// Celo Sepolia testnet
const celoSepolia: Chain = {
    id: 44787,
    name: 'Celo Sepolia Testnet',
    nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://rpc.ankr.com/celo_sepolia'] },
    },
    blockExplorers: {
        default: { name: 'CeloScan', url: 'https://sepolia.celoscan.io' },
    },
    testnet: true,
};

export const config = createConfig({
    chains: [celoSepolia],
    transports: {
        [celoSepolia.id]: http(),
    },
});
