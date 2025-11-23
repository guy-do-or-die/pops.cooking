import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { usePublicClient } from 'wagmi';
import { useWallets } from '@privy-io/react-auth';
import { createWalletClient, custom, decodeEventLog } from 'viem';
import { PopsFactoryABI } from '@/lib/PopsFactoryABI';
import { chain } from '@/lib/wagmi';
import { Loader2 } from 'lucide-react';

export const Home: React.FC = () => {
    const [, setLocation] = useLocation();
    const [minting, setMinting] = useState(false);
    const { wallets } = useWallets();
    const publicClient = usePublicClient();
    const contractAddress = import.meta.env.VITE_POPS_CONTRACT_ADDRESS as `0x${string}` | undefined;

    const mintToken = async () => {
        if (!contractAddress || !publicClient) {
            alert('Contract address or public client not available');
            return;
        }

        const wallet = wallets[0];
        if (!wallet) {
            alert('Please connect your wallet first');
            return;
        }

        setMinting(true);

        try {
            // Switch to Celo Sepolia if needed
            const chainId = `0x${chain.id.toString(16)}`;
            if (wallet.chainId !== chainId) {
                await wallet.switchChain(chain.id);
            }

            const provider = await wallet.getEthereumProvider();
            const walletClient = createWalletClient({
                chain,
                transport: custom(provider)
            });

            const [address] = await walletClient.getAddresses();

            // Mint token (creates Pop clone)
            console.log('Minting token...');
            
            const mintHash = await walletClient.writeContract({
                address: contractAddress,
                abi: PopsFactoryABI,
                functionName: 'mint',
                args: [address],
                account: address,
                chain
            });

            console.log('Mint transaction sent:', mintHash);
            const receipt = await publicClient.waitForTransactionReceipt({ hash: mintHash });
            console.log('Mint confirmed!', receipt);
            console.log('Receipt logs count:', receipt.logs.length);
            console.log('Receipt status:', receipt.status);
            
            // Decode the TokenMinted event from logs
            let newPopAddress: string | null = null;
            let newTokenId: bigint | null = null;

            if (receipt.logs && receipt.logs.length > 0) {
                for (const log of receipt.logs) {
                    try {
                        const decoded = decodeEventLog({
                            abi: PopsFactoryABI,
                            data: log.data,
                            topics: log.topics,
                        });

                        console.log('Decoded event:', decoded.eventName);

                        if (decoded.eventName === 'TokenMinted') {
                            newTokenId = decoded.args.tokenId;
                            newPopAddress = decoded.args.popClone;
                            console.log('Decoded TokenMinted:', { tokenId: newTokenId, popClone: newPopAddress });
                            break;
                        }
                    } catch (e) {
                        // Not our event
                        console.log('Could not decode log:', e);
                    }
                }
            }

            // Fallback: if no events, read from contract using tokenToPop mapping
            // The transaction succeeded, so a token was minted. We need to find which one.
            if (!newPopAddress) {
                console.log('No events found, reading from contract...');
                
                // Get the user's balance to find their token IDs
                // Since we just minted, try reading the most recent token (ID 0, 1, 2, etc.)
                // This is not perfect but works for testing
                for (let tokenId = 0n; tokenId < 10n; tokenId++) {
                    try {
                        const popAddr = await publicClient.readContract({
                            address: contractAddress,
                            abi: PopsFactoryABI,
                            functionName: 'tokenToPop',
                            args: [tokenId],
                        }) as string;

                        if (popAddr && popAddr !== '0x0000000000000000000000000000000000000000') {
                            // Check if this token belongs to the user
                            const balance = await publicClient.readContract({
                                address: contractAddress,
                                abi: [{
                                    "inputs": [
                                        {"internalType": "address", "name": "account", "type": "address"},
                                        {"internalType": "uint256", "name": "id", "type": "uint256"}
                                    ],
                                    "name": "balanceOf",
                                    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                                    "stateMutability": "view",
                                    "type": "function"
                                }],
                                functionName: 'balanceOf',
                                args: [address, tokenId],
                            }) as bigint;

                            if (balance > 0n) {
                                newPopAddress = popAddr;
                                newTokenId = tokenId;
                                console.log('Found token from contract:', { tokenId, popAddr });
                                break;
                            }
                        }
                    } catch (e) {
                        // Token doesn't exist, continue
                        break;
                    }
                }
            }

            if (!newPopAddress) {
                throw new Error('Failed to get Pop clone address');
            }

            // Navigate to the Pop page
            setLocation(`/pop/${newPopAddress}`);

        } catch (error) {
            console.error('Error minting token:', error);
            alert(`Minting failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setMinting(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[85vh] px-4 py-12">
            <div className="max-w-md w-full space-y-8 text-center">
                {/* Hero */}
                <div className="space-y-4">
                    <div className="text-8xl mb-6 animate-in fade-in duration-1000">🫧</div>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                        Proof of Progress
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-sm mx-auto">
                        Snap verifiable moments. Seal them on-chain.
                    </p>
                </div>

                {/* CTA */}
                <div className="pt-8">
                    {wallets.length === 0 ? (
                        <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                                Connect your wallet to get started
                            </p>
                            <div className="text-xs text-muted-foreground/60">
                                ↗ Use the button above
                            </div>
                        </div>
                    ) : (
                        <Button 
                            onClick={mintToken} 
                            disabled={minting || !contractAddress}
                            size="lg"
                            className="rounded-full px-8 py-6 text-base font-medium shadow-lg hover:shadow-xl transition-all"
                        >
                            {minting ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Creating your PoP...
                                </>
                            ) : (
                                <>
                                    <span className="mr-2">🫧</span>
                                    Create your PoP
                                </>
                            )}
                        </Button>
                    )}
                </div>

                {/* Footer info */}
                {contractAddress && (
                    <div className="pt-8 text-xs text-muted-foreground/50 font-mono">
                        {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)}
                    </div>
                )}
            </div>
        </div>
    );
};
