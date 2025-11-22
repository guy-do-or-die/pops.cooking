import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Square } from 'lucide-react';

export const Capture: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [recording, setRecording] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        async function setupCamera() {
            try {
                const s = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480, facingMode: 'user' },
                    audio: true
                });
                setStream(s);
                if (videoRef.current) {
                    videoRef.current.srcObject = s;
                }
            } catch (err) {
                console.error("Error accessing camera:", err);
            }
        }
        setupCamera();
        return () => {
            stream?.getTracks().forEach(track => track.stop());
        };
    }, []);

    useEffect(() => {
        let animationFrameId: number;

        const draw = () => {
            if (videoRef.current && canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

                    // Strobe Logic (Placeholder)
                    if (recording) {
                        const time = Date.now() % 1500; // 1.5s loop
                        if (time < 100) { // Flash for 100ms
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
    }, [recording]);

    const startRecording = () => {
        if (!canvasRef.current) return;

        // Create a stream from the canvas
        const canvasStream = canvasRef.current.captureStream(30);

        // Add audio track from the original stream
        if (stream) {
            stream.getAudioTracks().forEach(track => canvasStream.addTrack(track));
        }

        const recorder = new MediaRecorder(canvasStream, { mimeType: 'video/webm' });

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'capture.webm';
            a.click();
            chunksRef.current = [];
        };

        recorder.start();
        setMediaRecorder(recorder);
        setRecording(true);

        // Play Audio Chirps (Placeholder)
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        osc.connect(ctx.destination);
        osc.frequency.value = 900;
        osc.start();
        osc.stop(ctx.currentTime + 0.1); // 100ms chirp

        // Stop after 5 seconds
        setTimeout(() => {
            stopRecording();
        }, 5000);
    };

    const stopRecording = () => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        setRecording(false);
    };

    return (
        <div className="flex flex-col items-center gap-4 p-4">
            <div className="relative border rounded-lg overflow-hidden bg-black">
                <video ref={videoRef} autoPlay playsInline muted className="hidden" />
                <canvas ref={canvasRef} width={640} height={480} className="w-full max-w-[640px]" />
                {recording && (
                    <div className="absolute top-4 right-4 w-4 h-4 bg-red-500 rounded-full animate-pulse" />
                )}
            </div>

            <div className="flex gap-2">
                {!recording ? (
                    <Button onClick={startRecording} className="gap-2">
                        <Play className="w-4 h-4" /> Start Challenge
                    </Button>
                ) : (
                    <Button onClick={stopRecording} variant="destructive" className="gap-2">
                        <Square className="w-4 h-4" /> Stop
                    </Button>
                )}
            </div>
        </div>
    );
};
