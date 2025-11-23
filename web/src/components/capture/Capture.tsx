import React, { useEffect, useRef, useReducer, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, Camera } from 'lucide-react';
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

// State machine for the capture flow
type CapturePhase = 
    | 'idle'
    | 'preparing_challenge'
    | 'ready_to_capture'
    | 'capturing'
    | 'captured'
    | 'verifying'
    | 'verified'
    | 'failed'
    | 'sealing'
    | 'sealed';

interface CaptureState {
    phase: CapturePhase;
    challengeHash: string | null;
    derivedChallenge: DerivedChallenge | null;
    recordedBlob: Blob | null;
    verificationResult: VerificationResult | null;
    txStatus: string;
    error: string | null;
}

type CaptureAction =
    | { type: 'START_CHALLENGE_GENERATION' }
    | { type: 'CHALLENGE_READY'; hash: string; derived: DerivedChallenge }
    | { type: 'CHALLENGE_FAILED'; error: string }
    | { type: 'START_CAPTURE' }
    | { type: 'CAPTURE_COMPLETE'; blob: Blob }
    | { type: 'START_VERIFICATION' }
    | { type: 'VERIFICATION_COMPLETE'; result: VerificationResult }
    | { type: 'START_SEALING' }
    | { type: 'UPDATE_TX_STATUS'; status: string }
    | { type: 'SEALING_COMPLETE' }
    | { type: 'SEALING_FAILED'; error: string }
    | { type: 'RESET' };

const initialState: CaptureState = {
    phase: 'idle',
    challengeHash: null,
    derivedChallenge: null,
    recordedBlob: null,
    verificationResult: null,
    txStatus: '',
    error: null,
};

function captureReducer(state: CaptureState, action: CaptureAction): CaptureState {
    switch (action.type) {
        case 'START_CHALLENGE_GENERATION':
            return { ...state, phase: 'preparing_challenge', error: null };
        
        case 'CHALLENGE_READY':
            return {
                ...state,
                phase: state.phase === 'preparing_challenge' ? 'ready_to_capture' : 'idle',
                challengeHash: action.hash,
                derivedChallenge: action.derived,
                error: null,
            };
        
        case 'CHALLENGE_FAILED':
            return { ...state, phase: 'idle', error: action.error };
        
        case 'START_CAPTURE':
            return { ...state, phase: 'capturing' };
        
        case 'CAPTURE_COMPLETE':
            return { ...state, phase: 'captured', recordedBlob: action.blob };
        
        case 'START_VERIFICATION':
            return { ...state, phase: 'verifying' };
        
        case 'VERIFICATION_COMPLETE':
            return {
                ...state,
                phase: action.result.verified ? 'verified' : 'failed',
                verificationResult: action.result,
            };
        
        case 'START_SEALING':
            return { ...state, phase: 'sealing', txStatus: '' };
        
        case 'UPDATE_TX_STATUS':
            return { ...state, txStatus: action.status };
        
        case 'SEALING_COMPLETE':
            return { ...state, phase: 'sealed', txStatus: '✅ Sealed on-chain!' };
        
        case 'SEALING_FAILED':
            return { ...state, phase: 'verified', error: action.error, txStatus: '' };
        
        case 'RESET':
            return {
                ...initialState,
                phase: 'idle',
                challengeHash: state.challengeHash,
                derivedChallenge: state.derivedChallenge,
            };
        
        default:
            return state;
    }
}

export const Capture: React.FC<CaptureProps> = ({ disabled, popAddress }) => {
    const [state, dispatch] = useReducer(captureReducer, initialState);
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordingStartTime = useRef<number>(0);
    const audioContextStartTime = useRef<number>(0);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    
    const publicClient = usePublicClient();
    const { wallets } = useWallets();

    // Initialize camera
    useEffect(() => {
        let mounted = true;
        
        async function setupCamera() {
            try {
                console.log('[CAMERA] Requesting camera access...');
                const s = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480, facingMode: 'user' },
                    audio: true
                });
                
                if (!mounted) {
                    s.getTracks().forEach(t => t.stop());
                    return;
                }
                
                console.log('[CAMERA] Camera access granted, setting up video...');
                streamRef.current = s;
                
                if (videoRef.current) {
                    videoRef.current.srcObject = s;
                    // Wait for video to be ready
                    await new Promise<void>((resolve) => {
                        if (videoRef.current) {
                            videoRef.current.onloadedmetadata = () => {
                                console.log('[CAMERA] Video metadata loaded');
                                videoRef.current?.play().then(() => {
                                    console.log('[CAMERA] Video playing');
                                    resolve();
                                });
                            };
                        }
                    });
                }
            } catch (error) {
                console.error('[CAMERA] Failed to get camera access:', error);
            }
        }
        
        setupCamera();
        
        return () => {
            mounted = false;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }
        };
    }, []);

    // Fetch challenge on mount
    useEffect(() => {
        fetchChallengeFromContract();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [popAddress, publicClient]);

    // Auto-start capture when challenge is ready
    useEffect(() => {
        if (state.phase === 'ready_to_capture') {
            // Small delay to ensure state is propagated
            const timer = setTimeout(() => {
                dispatch({ type: 'START_CAPTURE' });
                startRecording();
            }, 100);
            return () => clearTimeout(timer);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.phase]);

    // Auto-verify when captured
    useEffect(() => {
        if (state.phase === 'captured' && state.recordedBlob) {
            dispatch({ type: 'START_VERIFICATION' });
            verifyRecording(state.recordedBlob);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.phase, state.recordedBlob]);

    // Auto-reset after sealing
    useEffect(() => {
        if (state.phase === 'sealed') {
            const timer = setTimeout(() => {
                dispatch({ type: 'RESET' });
                generateNewChallenge();
            }, 2000);
            return () => clearTimeout(timer);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.phase]);

    // Draw camera feed on canvas (always show live feed)
    useEffect(() => {
        if (!canvasRef.current || !videoRef.current || !streamRef.current) {
            console.log('[CANVAS] Not ready:', { 
                canvas: !!canvasRef.current, 
                video: !!videoRef.current, 
                stream: !!streamRef.current 
            });
            return;
        }

        const canvas = canvasRef.current;
        const video = videoRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.log('[CANVAS] No context');
            return;
        }

        console.log('[CANVAS] Starting canvas drawing loop');
        let animationFrameId: number;
        const draw = () => {
            if (!video || !ctx) return;
            
            // Only draw if video has data
            if (video.readyState >= video.HAVE_CURRENT_DATA) {
                // Always draw the video feed
                ctx.drawImage(video, 0, 0, 640, 480);
                
                // Only draw strobes when capturing
                if (state.phase === 'capturing' && state.derivedChallenge) {
                    const elapsed = performance.now() - recordingStartTime.current;
                    for (let i = 0; i < state.derivedChallenge.strobeTimings.length; i++) {
                        const timing = state.derivedChallenge.strobeTimings[i];
                        // Use 200ms flash duration to survive mobile video compression (iPhone compatible)
                        if (Math.abs(elapsed - timing) < 200) {
                            ctx.fillStyle = 'white';
                            ctx.fillRect(100, 100, 200, 200);
                        }
                    }
                }
            }
            
            animationFrameId = requestAnimationFrame(draw);
        };
        
        draw();
        return () => {
            console.log('[CANVAS] Stopping canvas drawing loop');
            cancelAnimationFrame(animationFrameId);
        };
    }, [state.phase, state.derivedChallenge]);

    const fetchChallengeFromContract = useCallback(async (retryCount = 0) => {
        if (!publicClient || !popAddress) return;

        try {
            const challenge = await publicClient.readContract({
                address: popAddress as `0x${string}`,
                abi: PopABI,
                functionName: 'currentChallenge',
            }) as any;

            const hash = challenge[0] as string;

            if (hash && hash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
                const derived = deriveChallenge(hash);
                dispatch({ type: 'CHALLENGE_READY', hash, derived });
            } else {
                generateNewChallenge();
            }
        } catch (error) {
            if (retryCount < 2) {
                setTimeout(() => fetchChallengeFromContract(retryCount + 1), (retryCount + 1) * 1000);
            } else {
                generateNewChallenge();
            }
        }
    }, [publicClient, popAddress]);

    const generateNewChallenge = useCallback(() => {
        const hash = generateChallengeHash();
        const derived = deriveChallenge(hash);
        dispatch({ type: 'CHALLENGE_READY', hash, derived });
    }, []);

    const generateChallengeOnChain = useCallback(async () => {
        if (!publicClient) {
            alert('Public client not available');
            return false;
        }

        const wallet = wallets[0];
        if (!wallet) {
            alert('No wallet connected');
            return false;
        }

        try {
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

            const txHash = await walletClient.writeContract({
                address: popAddress as `0x${string}`,
                abi: PopABI,
                functionName: 'generateChallenge',
                account: address,
                chain
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

            for (const log of receipt.logs) {
                try {
                    const decoded = decodeEventLog({
                        abi: PopABI,
                        data: log.data,
                        topics: log.topics,
                    });

                    if (decoded.eventName === 'ChallengeGenerated') {
                        const newHash = decoded.args.challengeHash;
                        const derived = deriveChallenge(newHash);
                        dispatch({ type: 'CHALLENGE_READY', hash: newHash, derived });
                        return true;
                    }
                } catch (e) {
                    // Not our event
                }
            }

            generateNewChallenge();
            return true;

        } catch (error) {
            console.error('Error generating challenge:', error);
            dispatch({ type: 'CHALLENGE_FAILED', error: error instanceof Error ? error.message : 'Unknown error' });
            return false;
        }
    }, [publicClient, wallets, popAddress, generateNewChallenge]);

    const handleSnap = useCallback(async () => {
        if (disabled || state.phase !== 'idle') return;
        
        dispatch({ type: 'START_CHALLENGE_GENERATION' });
        
        if (wallets.length > 0) {
            await generateChallengeOnChain();
        } else {
            await new Promise(resolve => setTimeout(resolve, 300));
            generateNewChallenge();
        }
    }, [disabled, state.phase, wallets.length, generateChallengeOnChain, generateNewChallenge]);

    const startRecording = useCallback(() => {
        if (!canvasRef.current || !state.derivedChallenge) return;

        chunksRef.current = [];
        recordingStartTime.current = performance.now();

        const canvasStream = canvasRef.current.captureStream(30);

        // Create audio with chirps
        const ctx = new AudioContext();
        const audioDestination = ctx.createMediaStreamDestination();
        audioContextStartTime.current = performance.now();

        const strobeTimesSec = state.derivedChallenge.strobeTimings
            .slice(0, state.derivedChallenge.audioFrequencies.length)
            .map((ms) => ms / 1000);

        state.derivedChallenge.audioFrequencies.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            gain.gain.value = 0.5;
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            gain.connect(audioDestination);
            
            osc.frequency.value = freq;
            osc.type = 'sine';
            
            const startTime = ctx.currentTime + strobeTimesSec[i];
            osc.start(startTime);
            osc.stop(startTime + 0.1);
        });

        const audioTracks = audioDestination.stream.getAudioTracks();
        audioTracks.forEach(track => canvasStream.addTrack(track));

        const recorder = new MediaRecorder(canvasStream, { mimeType: 'video/webm' });

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: 'video/webm' });
            dispatch({ type: 'CAPTURE_COMPLETE', blob });
        };

        recorder.start();
        mediaRecorderRef.current = recorder;

        setTimeout(() => {
            if (mediaRecorderRef.current?.state !== 'inactive') {
                mediaRecorderRef.current?.stop();
            }
        }, 5000);
    }, [state.derivedChallenge]);

    const verifyRecording = useCallback(async (blob: Blob) => {
        if (!state.challengeHash) return;

        const formData = new FormData();
        formData.append('file', blob, 'capture.webm');
        formData.append('pop_address', popAddress);

        try {
            const response = await fetch('/api/verify', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();
            dispatch({ type: 'VERIFICATION_COMPLETE', result });
        } catch (error) {
            dispatch({
                type: 'VERIFICATION_COMPLETE',
                result: {
                    verified: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                }
            });
        }
    }, [state.challengeHash, popAddress]);

    const handleSeal = useCallback(async () => {
        if (!state.verificationResult?.ipfs_cid || !state.challengeHash) return;

        const wallet = wallets[0];
        if (!wallet) {
            alert('Please connect your wallet first');
            return;
        }

        dispatch({ type: 'START_SEALING' });

        try {
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

            dispatch({ type: 'UPDATE_TX_STATUS', status: 'Preparing transaction...' });

            const txHash = await walletClient.writeContract({
                address: popAddress as `0x${string}`,
                abi: PopABI,
                functionName: 'recordProgress',
                args: [state.challengeHash as `0x${string}`, state.verificationResult.ipfs_cid],
                account: address,
                chain
            });

            dispatch({ type: 'UPDATE_TX_STATUS', status: 'Waiting for confirmation...' });
            await publicClient?.waitForTransactionReceipt({ hash: txHash });

            dispatch({ type: 'SEALING_COMPLETE' });

        } catch (error) {
            console.error('[SEAL] Error:', error);
            dispatch({
                type: 'SEALING_FAILED',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            alert(`Failed to seal: ${error instanceof Error ? error.message : String(error)}`);
        }
    }, [state.verificationResult, state.challengeHash, wallets, popAddress, publicClient]);

    // Button logic
    const getButtonConfig = () => {
        switch (state.phase) {
            case 'idle':
                return {
                    label: 'Snap PoP',
                    icon: <Camera className="w-5 h-5" />,
                    onClick: handleSnap,
                    disabled: disabled,
                };
            
            case 'preparing_challenge':
                return {
                    label: 'Preparing...',
                    icon: <Loader2 className="w-5 h-5 animate-spin" />,
                    disabled: true,
                };
            
            case 'capturing':
                return {
                    label: 'Capturing...',
                    icon: <Loader2 className="w-5 h-5 animate-spin" />,
                    disabled: true,
                };
            
            case 'captured':
            case 'verifying':
                return {
                    label: 'Verifying...',
                    icon: <Loader2 className="w-5 h-5 animate-spin" />,
                    disabled: true,
                };
            
            case 'verified':
                return {
                    label: 'Seal On-Chain',
                    icon: <Upload className="w-5 h-5" />,
                    onClick: handleSeal,
                    disabled: false,
                };
            
            case 'sealing':
                return {
                    label: state.txStatus || 'Sealing...',
                    icon: <Loader2 className="w-5 h-5 animate-spin" />,
                    disabled: true,
                };
            
            case 'sealed':
                return {
                    label: '✅ Sealed!',
                    icon: <Upload className="w-5 h-5" />,
                    disabled: true,
                };
            
            case 'failed':
                return {
                    label: 'Try Again',
                    icon: <Camera className="w-5 h-5" />,
                    onClick: handleSnap,
                    disabled: disabled,
                    variant: 'outline' as const,
                };
            
            default:
                return {
                    label: 'Loading...',
                    icon: <Loader2 className="w-5 h-5 animate-spin" />,
                    disabled: true,
                };
        }
    };

    const buttonConfig = getButtonConfig();

    return (
        <div className="flex flex-col items-center w-full space-y-8">
            {/* Video/Canvas Display */}
            <div className="relative rounded-3xl overflow-hidden bg-black shadow-2xl w-full ring-1 ring-white/10">
                <video ref={videoRef} autoPlay playsInline muted className="hidden" />
                <canvas 
                    ref={canvasRef} 
                    width={640} 
                    height={480} 
                    className={`w-full aspect-[4/3] ${
                        state.verificationResult?.verified && state.verificationResult?.screenshot_preview ? 'hidden' : ''
                    }`} 
                />
                
                {/* Recording indicator */}
                {state.phase === 'capturing' && (
                    <div className="absolute top-5 right-5 flex items-center gap-2 bg-black/70 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-white text-sm font-semibold tracking-tight">Recording</span>
                    </div>
                )}
                
                {/* Verified screenshot */}
                {state.verificationResult?.verified && state.verificationResult?.screenshot_preview && (
                    <div className="w-full aspect-[4/3] relative">
                        <img 
                            src={state.verificationResult.screenshot_preview} 
                            alt="Verified Screenshot" 
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute top-5 left-5 bg-green-500/95 backdrop-blur-md text-white px-5 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2.5 shadow-xl border border-white/20">
                            <span className="text-lg leading-none">✓</span>
                            <span className="tracking-tight">Verified</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Main Action Button */}
            <div className="w-full">
                <Button
                    onClick={buttonConfig.onClick}
                    disabled={buttonConfig.disabled}
                    className={`w-full gap-3 rounded-full shadow-lg hover:shadow-xl transition-all h-14 text-base font-semibold tracking-tight border-0 ${
                        buttonConfig.variant === 'outline' 
                            ? 'bg-gray-100 hover:bg-gray-200 text-gray-900' 
                            : 'bg-black hover:bg-black/90 text-white'
                    }`}
                    size="lg"
                    variant={buttonConfig.variant || 'default'}
                >
                    {buttonConfig.icon}
                    <span>{buttonConfig.label}</span>
                </Button>
            </div>

            {/* Error message */}
            {state.verificationResult?.error && (
                <div className="w-full p-5 bg-red-50 light:bg-red-950/20 border border-red-200 light:border-red-900 rounded-2xl text-center">
                    <p className="text-sm text-red-600 light:text-red-400 leading-relaxed">
                        {state.verificationResult.error}
                    </p>
                </div>
            )}

            {/* IPFS CID for verified (subtle) */}
            {state.verificationResult?.verified && state.verificationResult?.ipfs_cid && (
                <div className="text-xs text-muted-foreground/50 font-mono text-center break-all tracking-wider px-4">
                    {state.verificationResult.ipfs_cid}
                </div>
            )}
        </div>
    );
};
