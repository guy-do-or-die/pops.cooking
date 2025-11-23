import React from 'react';
import { useRoute, Link } from 'wouter';
import { Capture } from '@/components/capture/Capture';
import { Button } from '@/components/ui/button';
import { History } from 'lucide-react';

export const PopPage: React.FC = () => {
    const [, params] = useRoute('/pop/:address');
    const popAddress = params?.address;

    if (!popAddress) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
                <span className="text-6xl mb-4">🫧</span>
                <h2 className="text-2xl font-semibold mb-2">Invalid address</h2>
                <Link href="/">
                    <a className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        Go home
                    </a>
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto px-6 py-12">
            {/* Top Nav */}
            <div className="flex items-center justify-end mb-12">
                <Link href={`/pop/${popAddress}/progress`}>
                    <Button variant="ghost" size="sm" className="rounded-full font-medium">
                        <History className="mr-2 h-4 w-4" />
                        History
                    </Button>
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
