import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Square, Upload, RefreshCw } from 'lucide-react';
import { generateChallengeHash, deriveChallenge, type DerivedChallenge } from '@/lib/challenge';
import { usePublicClient } from 'wagmi';
import { useWallets } from '@privy-io/react-auth';
import { decodeEventLog, createWalletClient, custom } from 'viem';
import { PopABI } from '@/lib/PopABI';
import { chain } from '@/lib/wagmi';

interface VerificationResult {
    verified: boolean;
    challenge?: string;
    ipfs_cid?: string;
    screenshot_preview?: string;
    metrics?: any;
    error?: string;
}

interface CaptureProps {
    disabled?: boolean;
    popAddress: string;
}

export const Capture: React.FC<CaptureProps> = ({ disabled, popAddress: popAddressProp }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordingStartTime = useRef<number>(0);
    const audioContextStartTime = useRef<number>(0);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [recording, setRecording] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    const [verifying, setVerifying] = useState(false);
    const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
    const [recordingProgress, setRecordingProgress] = useState(false);
    const [txStatus, setTxStatus] = useState<string>('');
    const [challengeHash, setChallengeHash] = useState<string>('');
    const [derivedChallenge, setDerivedChallenge] = useState<DerivedChallenge | null>(null);
    const popAddress = popAddressProp;
    const chunksRef = useRef<Blob[]>([]);
    const publicClient = usePublicClient();
    const { wallets } = useWallets();

    // Fetch existing challenge from Pop contract on mount
    useEffect(() => {
        fetchChallengeFromContract();
    }, [popAddress, publicClient]);

    const fetchChallengeFromContract = async (retryCount = 0) => {
        if (!publicClient || !popAddress) {
            console.log('Cannot fetch challenge: missing publicClient or popAddress');
            return;
        }

        try {
            console.log(`[CHALLENGE] Fetching existing challenge from Pop contract... (attempt ${retryCount + 1}/3)`);
            
            const challenge = await publicClient.readContract({
                address: popAddress as `0x${string}`,
                abi: PopABI,
                functionName: 'currentChallenge',
            }) as any;

            console.log('[CHALLENGE] Raw challenge from contract:', challenge);

            // Challenge structure: [challengeHash, baseBlock, expiresBlock]
            const hash = challenge[0] as string;

            if (hash && hash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                console.log('[CHALLENGE] Found existing challenge:', hash);
                const derived = deriveChallenge(hash);
                setChallengeHash(hash);
                setDerivedChallenge(derived);
                console.log('[CHALLENGE] Loaded challenge from contract:', { hash, derived });
            } else {
                console.warn('[CHALLENGE] No valid challenge found in contract, generating local challenge');
                generateNewChallenge();
            }
        } catch (error) {
            // Expected for newly created contracts - RPC needs time to sync
            if (retryCount < 2) {
                console.log(`[CHALLENGE] Contract not ready yet, retrying in ${(retryCount + 1) * 1000}ms... (attempt ${retryCount + 1}/3)`);
                setTimeout(() => fetchChallengeFromContract(retryCount + 1), (retryCount + 1) * 1000);
            } else {
                console.warn('[CHALLENGE] Contract still not ready after 3 attempts. RPC may be slow.');
                console.warn('[CHALLENGE] Generating local challenge as fallback.');
                generateNewChallenge();
            }
        }
    };

    const generateNewChallenge = () => {
        const hash = generateChallengeHash();
        const derived = deriveChallenge(hash);
        setChallengeHash(hash);
        setDerivedChallenge(derived);
        setRecordedBlob(null);
        setVerificationResult(null);
        console.log('Generated challenge (local):', { hash, derived });
    };

    const generateChallengeOnPop = async () => {
        if (!publicClient) {
            alert('Public client not available');
            return;
        }

        const wallet = wallets[0];
        if (!wallet) {
            alert('No wallet connected');
            return;
        }

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

            // Generate challenge on Pop clone
            console.log('Generating challenge on the Pop...');
            const challengeHash = await walletClient.writeContract({
                address: popAddress as `0x${string}`,
                abi: PopABI,
                functionName: 'generateChallenge',
                account: address,
                chain
            });

            console.log('Challenge transaction sent:', challengeHash);
            const challengeReceipt = await publicClient.waitForTransactionReceipt({ hash: challengeHash });
            console.log('Challenge confirmed:', challengeReceipt);

            // Decode ChallengeGenerated event
            for (const log of challengeReceipt.logs) {
                try {
                    const decoded = decodeEventLog({
                        abi: PopABI,
                        data: log.data,
                        topics: log.topics,
                    });

                    if (decoded.eventName === 'ChallengeGenerated') {
                        const newHash = decoded.args.challengeHash;
                        console.log('On-chain challenge hash:', newHash);

                        const derived = deriveChallenge(newHash);
                        setChallengeHash(newHash);
                        setDerivedChallenge(derived);
                        setRecordedBlob(null);
                        setVerificationResult(null);
                        return;
                    }
                } catch (e) {
                    // Not our event
                }
            }

            console.warn('ChallengeGenerated event not found in logs');
            generateNewChallenge();

        } catch (error) {
            console.error('Error calling contract:', error);
            alert(`Transaction failed: ${error instanceof Error ? error.message : String(error)}`);
            generateNewChallenge();
        }
    };

    useEffect(() => {
        async function setupCamera() {
            try {
                console.log('Setting up camera...');
                const s = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480, facingMode: 'user' },
                    audio: true
                });
                console.log('Camera stream acquired:', s);
                setStream(s);
                if (videoRef.current) {
                    videoRef.current.srcObject = s;
                    videoRef.current.play(); // Ensure video plays
                    console.log('Video element srcObject set and playing');
                }
            } catch (err) {
                console.error("Error accessing camera:", err);
            }
        }
        setupCamera();
        return () => {
            console.log('Cleanup: stopping stream tracks');
            stream?.getTracks().forEach(track => track.stop());
        };
    }, []);

    // Auto-stop recording after 5 seconds
    useEffect(() => {
        if (!recording) return;

        console.log('Setting up 5-second auto-stop timer');
        const timer = setTimeout(() => {
            console.log('5 seconds elapsed, auto-stopping recording');
            stopRecording();
        }, 5000);

        return () => {
            console.log('Cleaning up timer');
            clearTimeout(timer);
        };
    }, [recording]);

    useEffect(() => {
        let animationFrameId: number;

        const draw = () => {
            if (videoRef.current && canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                    ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

                    // Strobe Logic using derived challenge
                    if (recording && derivedChallenge && audioContextStartTime.current > 0) {
                        // Calculate elapsed time from AudioContext start to stay in sync with chirps
                        // performance.now() returns milliseconds, strobeTimings are in milliseconds
                        const elapsed = performance.now() - audioContextStartTime.current;

                        // Check if current time matches any strobe timing (±150ms tolerance)
                        const shouldStrobe = derivedChallenge.strobeTimings.some(timing =>
                            Math.abs(elapsed - timing) < 150
                        );

                        if (shouldStrobe) {
                            console.log(`[STROBE] Drawing at elapsed=${elapsed.toFixed(0)}ms`);
                            ctx.fillStyle = 'white';
                            ctx.fillRect(100, 100, 200, 200);
                        }
                    }
                }
            }
            animationFrameId = requestAnimationFrame(draw);
        };
        draw();
        return () => cancelAnimationFrame(animationFrameId);
    }, [recording, derivedChallenge]);

    const startRecording = () => {
        if (disabled) {
            return;
        }
        if (!canvasRef.current || !derivedChallenge) {
            console.error('Canvas ref is null or challenge not generated');
            return;
        }

        console.log('Starting recording with challenge:', challengeHash);
        setRecordedBlob(null);
        setVerificationResult(null);
        chunksRef.current = [];
        
        recordingStartTime.current = performance.now();

        const canvasStream = canvasRef.current.captureStream(30);
        console.log('Canvas stream created:', canvasStream);

        // Create AudioContext and destination for synthetic audio
        const ctx = new AudioContext();
        const audioDestination = ctx.createMediaStreamDestination();
        
        console.log('[AUDIO] Playing chirps at frequencies:', derivedChallenge.audioFrequencies);
        console.log('[TIMING] Strobe timings (ms):', derivedChallenge.strobeTimings);
        
        // Store when AudioContext starts for strobe timing sync
        audioContextStartTime.current = performance.now();
        console.log('[TIMING] AudioContext started at performance.now():', audioContextStartTime.current);

        const strobeTimesSec = derivedChallenge.strobeTimings
            .slice(0, derivedChallenge.audioFrequencies.length)
            .map((ms) => ms / 1000);

        console.log('[AUDIO] Chirp schedule (seconds):', strobeTimesSec);

        // Create chirps and connect to both speakers and recording
        derivedChallenge.audioFrequencies.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            gain.gain.value = 0.5; // Moderate volume
            
            osc.connect(gain);
            gain.connect(ctx.destination); // Play to speakers
            gain.connect(audioDestination); // Record to stream
            
            osc.frequency.value = freq;

            const offset = strobeTimesSec[i] ?? i * 1.5;
            const startTime = ctx.currentTime + offset;

            console.log(`[AUDIO] Chirp ${i}: ${freq}Hz at ctx.currentTime=${ctx.currentTime.toFixed(3)} + offset=${offset.toFixed(3)} = ${startTime.toFixed(3)}s`);

            osc.start(startTime);
            osc.stop(startTime + 0.1);
        });

        // Add synthetic audio track to canvas stream
        const audioTracks = audioDestination.stream.getAudioTracks();
        console.log('Audio tracks from AudioContext:', audioTracks);
        audioTracks.forEach(track => canvasStream.addTrack(track));

        const recorder = new MediaRecorder(canvasStream, { mimeType: 'video/webm' });
        console.log('MediaRecorder created:', recorder);

        recorder.ondataavailable = (e) => {
            console.log('Data available:', e.data.size, 'bytes');
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
            console.log('MediaRecorder stopped. Chunks:', chunksRef.current.length);
            const blob = new Blob(chunksRef.current, { type: 'video/webm' });
            console.log('Blob created:', blob.size, 'bytes');
            console.log('Setting recorded blob and ending recording state...');
            setRecordedBlob(blob);
            setRecording(false);
            console.log('State updated, should trigger re-render with Verify button');
        };

        recorder.onerror = (e) => {
            console.error('MediaRecorder error:', e);
        };

        recorder.start();
        console.log('MediaRecorder started, state:', recorder.state);
        mediaRecorderRef.current = recorder;
        setRecording(true);
    };

    const stopRecording = () => {
        console.log('stopRecording called');
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            console.log('Stopping mediaRecorder, current state:', mediaRecorderRef.current.state);
            mediaRecorderRef.current.stop();
        } else {
            console.log('MediaRecorder already inactive or null');
        }
    };

    const verifyRecording = async () => {
        if (disabled) {
            return;
        }
        if (!recordedBlob || !challengeHash || !popAddress) {
            console.error('Missing required data for verification');
            return;
        }

        setVerifying(true);
        setVerificationResult(null);

        const formData = new FormData();
        formData.append('file', recordedBlob, 'capture.webm');
        formData.append('pop_address', popAddress);

        try {
            const response = await fetch('/api/verify', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();
            console.log('[VERIFY] Server response:', JSON.stringify(result, null, 2));
            setVerificationResult(result);
        } catch (error) {
            setVerificationResult({
                verified: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        } finally {
            setVerifying(false);
        }
    };

    const recordProgressOnChain = async () => {
        if (!verificationResult?.ipfs_cid || !challengeHash || !popAddress) {
            console.error('Missing required data for recording progress');
            return;
        }

        const wallet = wallets[0];
        if (!wallet) {
            alert('Please connect your wallet first');
            return;
        }

        setRecordingProgress(true);
        setTxStatus('Preparing transaction...');

        try {
            const provider = await wallet.getEthereumProvider();
            const walletClient = createWalletClient({
                chain,
                transport: custom(provider)
            });

            const [address] = await walletClient.getAddresses();

            console.log('[PROGRESS] Recording progress on-chain...');
            console.log('[PROGRESS] Challenge:', challengeHash);
            console.log('[PROGRESS] IPFS CID:', verificationResult.ipfs_cid);

            setTxStatus('Sending transaction...');
            const txHash = await walletClient.writeContract({
                address: popAddress as `0x${string}`,
                abi: PopABI,
                functionName: 'recordProgress',
                args: [challengeHash as `0x${string}`, verificationResult.ipfs_cid],
                account: address,
                chain
            });

            console.log('[PROGRESS] Transaction sent:', txHash);
            setTxStatus('Waiting for confirmation...');
            await publicClient?.waitForTransactionReceipt({ hash: txHash });
            console.log('[PROGRESS] Progress recorded on-chain!');

            setTxStatus('✅ Progress recorded on-chain!');
            
            // Reset for next recording after showing success
            setTimeout(() => {
                setRecordedBlob(null);
                setVerificationResult(null);
                setTxStatus('');
                generateNewChallenge();
            }, 2000);

        } catch (error) {
            console.error('[PROGRESS] Error recording progress:', error);
            setTxStatus('');
            alert(`Failed to record progress: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setRecordingProgress(false);
        }
    };

    return (
        <div className="flex flex-col items-center gap-4 p-4 w-full max-w-4xl">
            {/* Challenge Info */}
            {challengeHash && derivedChallenge && (
                <div className="w-full border rounded-lg p-3 bg-muted text-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">Challenge Hash:</span>
                        <Button
                            onClick={() => wallets.length > 0 ? generateChallengeOnPop() : generateNewChallenge()}
                            variant="ghost"
                            size="sm"
                            className="gap-1 h-7"
                            disabled={disabled || recording || verifying}
                        >
                            <RefreshCw className="w-3 h-3" />
                            {wallets.length > 0 ? 'Generate' : 'New'}
                        </Button>
                    </div>
                    <div className="font-mono text-xs break-all opacity-70">{challengeHash}</div>
                    <div className="mt-2 text-xs opacity-60">
                        Freqs: {derivedChallenge.audioFrequencies.map(f => f.toFixed(0)).join(', ')} Hz
                    </div>
                    {/* Debug Info */}
                    <div className="mt-2 text-[10px] opacity-50 border-t pt-1">
                        Wallet: {wallets.length > 0 ? 'Connected' : 'No'} |
                        Pop: {popAddress.slice(0, 6)}...{popAddress.slice(-4)}
                    </div>
                </div>
            )}

            <div className="relative border rounded-lg overflow-hidden bg-black">
                <video ref={videoRef} autoPlay playsInline muted className="hidden" />
                <canvas ref={canvasRef} width={640} height={480} className={`w-full max-w-[640px] ${verificationResult?.verified && verificationResult?.screenshot_preview ? 'hidden' : ''}`} />
                {recording && (
                    <div className="absolute top-4 right-4 w-4 h-4 bg-red-500 rounded-full animate-pulse" />
                )}
                {/* Show screenshot preview when verified */}
                {verificationResult?.verified && verificationResult?.screenshot_preview && (
                    <div className="w-full max-w-[640px]">
                        <img 
                            src={verificationResult.screenshot_preview} 
                            alt="Verified Screenshot" 
                            className="w-full h-auto"
                        />
                        <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2">
                            ✓ Verified
                        </div>
                    </div>
                )}
            </div>

            <div className="flex gap-2">
                {!recording ? (
                    <>
                        <Button
                            onClick={startRecording}
                            className="gap-2"
                            disabled={disabled || (!!recordedBlob && !verifying)}
                        >
                            <Play className="w-4 h-4" /> Capture (5s)
                        </Button>
                        {recordedBlob && (
                            <Button
                                onClick={verifyRecording}
                                variant="secondary"
                                className="gap-2"
                                disabled={disabled || verifying}
                            >
                                <Upload className="w-4 h-4" /> {verifying ? 'Verifying...' : 'Verify'}
                            </Button>
                        )}
                    </>
                ) : (
                    <Button onClick={stopRecording} variant="destructive" className="gap-2">
                        <Square className="w-4 h-4" /> Stop
                    </Button>
                )}
            </div>

            {verificationResult && (
                <div className="w-full border rounded-lg p-4 bg-muted">
                    <h3 className="font-semibold mb-2">Verification Result</h3>
                    <div className="space-y-2 text-sm font-mono">
                        <div>
                            <span className="font-semibold">Status: </span>
                            <span className={verificationResult.verified ? 'text-green-600' : 'text-red-600'}>
                                {verificationResult.verified ? '✓ Verified' : '✗ Failed'}
                            </span>
                        </div>
                        {verificationResult.verified && verificationResult.ipfs_cid && (
                            <div className="space-y-2">
                                <div>
                                    <span className="font-semibold">IPFS CID: </span>
                                    <span className="text-blue-600 font-mono text-sm break-all">{verificationResult.ipfs_cid}</span>
                                </div>
                                <div className="text-xs text-green-600 bg-green-50 border border-green-200 rounded p-2">
                                    ✅ <strong>Screenshot uploaded to IPFS</strong> - Ready to record on-chain!
                                </div>
                                <Button
                                    onClick={recordProgressOnChain}
                                    disabled={recordingProgress}
                                    className="w-full gap-2"
                                >
                                    {recordingProgress ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            Recording Progress...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-4 h-4" />
                                            Record Progress On-Chain
                                        </>
                                    )}
                                </Button>
                                {txStatus && (
                                    <div className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded p-2 text-center">
                                        {txStatus}
                                    </div>
                                )}
                            </div>
                        )}
                        {verificationResult.error && (
                            <div>
                                <span className="font-semibold">Error: </span>
                                <span className="text-red-600">{verificationResult.error}</span>
                            </div>
                        )}
                        {verificationResult.metrics && (
                            <details className="mt-2">
                                <summary className="font-semibold cursor-pointer">Debug Info</summary>
                                <pre className="mt-2 p-2 bg-background rounded text-xs overflow-auto">
                                    {JSON.stringify(verificationResult.metrics, null, 2)}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
