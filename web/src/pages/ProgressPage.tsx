import React, { useEffect, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { PopABI } from '@/lib/PopABI';
import { formatDistanceToNow } from 'date-fns';

interface ProgressRecord {
  challengeHash: string;
  ipfsCid: string;
  timestamp: bigint;
  popAddress: string;
}

const IPFS_GATEWAY = import.meta.env.VITE_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs';

export const ProgressPage: React.FC<{ popAddress: string }> = ({ popAddress }) => {
  const [records, setRecords] = useState<ProgressRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const publicClient = usePublicClient();

  const loadHistory = async () => {
    if (!publicClient || !popAddress) return;
    
    setLoading(true);
    setError(null);

    try {
      console.log('[HISTORY] Fetching progress from contract:', popAddress);

      // Read all progress entries from contract storage
      const progressEntries = await publicClient.readContract({
        address: popAddress as `0x${string}`,
        abi: PopABI,
        functionName: 'getAllProgress'
      }) as any[];

      console.log('[HISTORY] Found', progressEntries.length, 'progress records');

      // Map to our format and sort (most recent first)
      const parsedRecords: ProgressRecord[] = progressEntries.map((entry: any) => ({
        challengeHash: entry.challengeHash as string,
        ipfsCid: entry.ipfsCid as string,
        timestamp: entry.timestamp as bigint,
        popAddress
      })).reverse(); // Reverse to show most recent first

      setRecords(parsedRecords);
    } catch (err: any) {
      console.error('[HISTORY] Error fetching history:', err);
      setError(err.message || 'Failed to fetch history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [publicClient, popAddress]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading PoP history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4 text-red-500">Error</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={loadHistory} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href={`/pop/${popAddress}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Pop
              </Button>
            </Link>
          </div>
          <Button onClick={loadHistory} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">PoP Progress</h1>
          <p className="text-sm text-muted-foreground font-mono mb-2">{popAddress}</p>
          <p className="text-muted-foreground">
            {records.length} verification{records.length !== 1 ? 's' : ''} recorded
          </p>
        </div>

        {records.length === 0 ? (
          <div className="text-center py-12 bg-muted rounded-lg">
            <p className="text-muted-foreground text-lg">No progress recorded yet</p>
            <Link href={`/pop/${popAddress}`}>
              <Button className="mt-4">Record Your First PoP</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {records.map((record, index) => (
              <div
                key={`${record.challengeHash}-${index}`}
                className="bg-card border rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="aspect-video bg-muted relative">
                  <img
                    src={`${IPFS_GATEWAY}/${record.ipfsCid}`}
                    alt="PoP Screenshot"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
                <div className="p-4 space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Challenge</p>
                    <p className="text-sm font-mono truncate">{record.challengeHash}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">IPFS CID</p>
                    <a
                      href={`${IPFS_GATEWAY}/${record.ipfsCid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-mono text-blue-500 hover:underline truncate block"
                    >
                      {record.ipfsCid}
                    </a>
                  </div>
                  <div className="pt-2 border-t">
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(Number(record.timestamp) * 1000, { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
