import React from 'react';
import { useRoute, Link } from 'wouter';
import { Capture } from '@/components/capture/Capture';
import { History } from 'lucide-react';

export const PopPage: React.FC = () => {
    const [, params] = useRoute('/pop/:address');
    const popAddress = params?.address;

    if (!popAddress) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
                <span className="text-6xl mb-4">🫧</span>
                <h2 className="text-2xl font-semibold mb-2">Invalid address</h2>
                <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Go home
                </Link>
            </div>
        );
    }

    return (
        <div className="w-full px-6 py-12 max-w-2xl mx-auto">
            {/* Top Nav */}
            <div className="flex items-center justify-end mb-12">
                <Link href={`/pop/${popAddress}/progress`}>
                    <button className="flex items-center gap-2 rounded-full font-medium bg-transparent hover:bg-gray-100 text-gray-700 border-0 px-4 py-2 text-sm transition-colors">
                        <History className="h-4 w-4" />
                        Progress
                    </button>
                </Link>
            </div>

            {/* Address Info */}
            <div className="mb-10 text-center">
                <div className="text-xs font-mono text-muted-foreground/50 tracking-wider">
                    {popAddress.slice(0, 6)}...{popAddress.slice(-4)}
                </div>
            </div>

            {/* Capture Component */}
            <Capture popAddress={popAddress} />
        </div>
    );
};
