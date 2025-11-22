import { http, createConfig } from 'wagmi';
import { celoSepolia } from 'viem/chains';

export const chain = celoSepolia;

export const config = createConfig({
    chains: [chain],
    transports: {
        [chain.id]: http(),
    },
});
