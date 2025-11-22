import React from 'react';
import { useRoute } from 'wouter';
import { Capture } from '@/components/capture/Capture';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

export const PopPage: React.FC = () => {
    const [, params] = useRoute('/pop/:address');
    const popAddress = params?.address;

    if (!popAddress) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-4">Invalid Pop Address</h2>
                    <Link href="/">
                        <Button variant="outline">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Home
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-4">
            <div className="max-w-4xl mx-auto">
                <div className="mb-4">
                    <Link href="/">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back
                        </Button>
                    </Link>
                </div>

                <div className="mb-6">
                    <h1 className="text-2xl font-bold mb-2">Pop #{popAddress}</h1>
                    <p className="text-sm text-muted-foreground font-mono">
                        {popAddress}
                    </p>
                </div>

                <Capture popAddress={popAddress} />
            </div>
        </div>
    );
};
