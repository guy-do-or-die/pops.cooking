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
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <div className="max-w-2xl w-full space-y-8 text-center">
                <div>
                    <h1 className="text-4xl font-bold mb-4">Pops</h1>
                    <p className="text-lg text-muted-foreground mb-8">
                        Proof of Progress System - Mint your token to get started
                    </p>
                </div>

                <div className="border rounded-lg p-8 bg-card">
                    <h2 className="text-2xl font-semibold mb-4">Get Started</h2>
                    <p className="text-muted-foreground mb-6">
                        Mint an ERC1155 token to create your personal Pop clone for tracking challenges and progress.
                    </p>
                    
                    {wallets.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            Please connect your wallet to continue
                        </p>
                    ) : (
                        <Button 
                            onClick={mintToken} 
                            disabled={minting || !contractAddress}
                            size="lg"
                            className="w-full max-w-xs"
                        >
                            {minting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Minting...
                                </>
                            ) : (
                                'Mint Token'
                            )}
                        </Button>
                    )}

                    {contractAddress && (
                        <p className="text-xs text-muted-foreground mt-4">
                            Contract: {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)}
                        </p>
                    )}
                </div>

                <div className="text-sm text-muted-foreground">
                    <p>Each token gets its own Pop clone for:</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Generating unique challenges</li>
                        <li>Recording verified progress</li>
                        <li>Tracking your journey</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};
