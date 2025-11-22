import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Square, Upload, RefreshCw } from 'lucide-react';
import { generateChallengeHash, deriveChallenge, type DerivedChallenge } from '@/lib/challenge';
import { usePublicClient } from 'wagmi';
import { useWallets } from '@privy-io/react-auth';
import { decodeEventLog, createWalletClient, custom } from 'viem';
import { PopsABI } from '@/lib/PopsABI';
import { chain } from '@/lib/wagmi';

interface VerificationResult {
    verified: boolean;
    challenge?: string;
    metrics?: any;
    error?: string;
}

interface CaptureProps {
    disabled?: boolean;
}

export const Capture: React.FC<CaptureProps> = ({ disabled }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordingStartTime = useRef<number>(0);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [recording, setRecording] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    const [verifying, setVerifying] = useState(false);
    const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
    const [challengeHash, setChallengeHash] = useState<string>('');
    const [derivedChallenge, setDerivedChallenge] = useState<DerivedChallenge | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const { wallets } = useWallets();
    const publicClient = usePublicClient();

    // Contract address from env
    const contractAddress = import.meta.env.VITE_POPS_CONTRACT_ADDRESS as `0x${string}` | undefined;

    // Generate initial challenge on mount
    useEffect(() => {
        generateNewChallenge();
    }, []);

    const generateNewChallenge = () => {
        const hash = generateChallengeHash();
        const derived = deriveChallenge(hash);
        setChallengeHash(hash);
        setDerivedChallenge(derived);
        console.log('Generated challenge (local):', { hash, derived });
    };

    const generateChallengeFromContract = async () => {
        if (!contractAddress || !publicClient) {
            alert('Contract address or public client not available');
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
            console.log('Checking chain ID. Wallet:', wallet.chainId, 'Required:', chainId);
            if (wallet.chainId !== chainId) {
                console.log('Switching chain...');
                await wallet.switchChain(chain.id);
            }

            const provider = await wallet.getEthereumProvider();
            const walletClient = createWalletClient({
                chain,
                transport: custom(provider)
            });

            const [address] = await walletClient.getAddresses();

            const hash = await walletClient.writeContract({
                address: contractAddress,
                abi: PopsABI,
                functionName: 'generateChallenge',
                account: address,
                chain
            });

            console.log('Transaction sent:', hash);

            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            console.log('Transaction confirmed:', receipt);

            // We can just look at the logs and try to decode
            for (const log of receipt.logs) {
                try {
                    const decoded = decodeEventLog({
                        abi: PopsABI,
                        data: log.data,
                        topics: log.topics,
                    });

                    if (decoded.eventName === 'ChallengeGenerated') {
                        const newHash = decoded.args.challengeHash;
                        console.log('On-chain challenge hash:', newHash);

                        const derived = deriveChallenge(newHash);
                        setChallengeHash(newHash);
                        setDerivedChallenge(derived);
                        return;
                    }
                } catch (e) {
                    // Not our event
                }
            }

            console.warn('ChallengeGenerated event not found in logs');
            // Fallback if event not found (shouldn't happen if tx succeeded)
            generateNewChallenge();

        } catch (error) {
            console.error('Error calling contract:', error);
            alert(`Transaction failed: ${error instanceof Error ? error.message : String(error)}`);
            // Fallback to local generation
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
                    if (recording && derivedChallenge && recordingStartTime.current > 0) {
                        const elapsed = Date.now() - recordingStartTime.current;

                        // Check if current time matches any strobe timing (±50ms tolerance)
                        const shouldStrobe = derivedChallenge.strobeTimings.some(timing =>
                            Math.abs(elapsed - timing) < 50
                        );

                        if (shouldStrobe) {
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
        recordingStartTime.current = Date.now();

        const canvasStream = canvasRef.current.captureStream(30);
        console.log('Canvas stream created:', canvasStream);

        if (stream) {
            const audioTracks = stream.getAudioTracks();
            console.log('Audio tracks:', audioTracks);
            audioTracks.forEach(track => canvasStream.addTrack(track));
        }

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

        // Play Audio Chirps using derived frequencies
        const ctx = new AudioContext();
        console.log('Playing chirps at frequencies:', derivedChallenge.audioFrequencies);
        derivedChallenge.audioFrequencies.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.connect(ctx.destination);
            osc.frequency.value = freq;
            const startTime = ctx.currentTime + i * 1.5;
            osc.start(startTime);
            osc.stop(startTime + 0.1);
        });
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
        if (!recordedBlob || !challengeHash) return;

        setVerifying(true);
        setVerificationResult(null);

        const formData = new FormData();
        formData.append('file', recordedBlob, 'capture.webm');
        formData.append('challenge', challengeHash);
        formData.append('base_block', '100');
        formData.append('expires_block', '200');

        try {
            const response = await fetch('/api/verify', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();
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

    return (
        <div className="flex flex-col items-center gap-4 p-4 w-full max-w-4xl">
            {/* Challenge Info */}
            {challengeHash && derivedChallenge && (
                <div className="w-full border rounded-lg p-3 bg-muted text-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">Challenge Hash:</span>
                        <Button
                            onClick={() => wallets.length > 0 && contractAddress ? generateChallengeFromContract() : generateNewChallenge()}
                            variant="ghost"
                            size="sm"
                            className="gap-1 h-7"
                            disabled={disabled || recording || verifying}
                        >
                            <RefreshCw className="w-3 h-3" />
                            {wallets.length > 0 && contractAddress ? 'From Contract' : 'New'}
                        </Button>
                    </div>
                    <div className="font-mono text-xs break-all opacity-70">{challengeHash}</div>
                    <div className="mt-2 text-xs opacity-60">
                        Freqs: {derivedChallenge.audioFrequencies.map(f => f.toFixed(0)).join(', ')} Hz
                    </div>
                    {/* Debug Info */}
                    <div className="mt-2 text-[10px] opacity-50 border-t pt-1">
                        Wallet: {wallets.length > 0 ? 'Connected' : 'No'} |
                        Contract: {contractAddress ? 'Set' : 'Missing'} |
                        Addr: {contractAddress?.slice(0, 6)}...
                    </div>
                </div>
            )}

            <div className="relative border rounded-lg overflow-hidden bg-black">
                <video ref={videoRef} autoPlay playsInline muted className="hidden" />
                <canvas ref={canvasRef} width={640} height={480} className="w-full max-w-[640px]" />
                {recording && (
                    <div className="absolute top-4 right-4 w-4 h-4 bg-red-500 rounded-full animate-pulse" />
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
                        {verificationResult.error && (
                            <div>
                                <span className="font-semibold">Error: </span>
                                <span className="text-red-600">{verificationResult.error}</span>
                            </div>
                        )}
                        {verificationResult.metrics && (
                            <div>
                                <span className="font-semibold">Debug Info:</span>
                                <pre className="mt-2 p-2 bg-background rounded text-xs overflow-auto">
                                    {JSON.stringify(verificationResult.metrics, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
