import { http, createConfig } from 'wagmi';
import { celoSepolia } from 'viem/chains';

export const chain = celoSepolia;

// Use a reliable RPC endpoint (Ankr by default)
const rpcUrl = import.meta.env.VITE_RPC_URL || 'https://rpc.ankr.com/celo_sepolia';

export const config = createConfig({
    chains: [chain],
    transports: {
        [chain.id]: http(rpcUrl),
    },
});
