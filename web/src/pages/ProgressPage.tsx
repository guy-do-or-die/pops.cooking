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
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] px-4">
        <div className="text-center max-w-md">
          <span className="text-5xl mb-4 block">🫧</span>
          <h2 className="text-xl font-semibold mb-2">Failed to load</h2>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <Button onClick={loadHistory} variant="outline" className="rounded-full">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <Link href={`/pop/${popAddress}`}>
          <Button variant="ghost" size="sm" className="rounded-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <Button onClick={loadHistory} variant="ghost" size="sm" className="rounded-full">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Title */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-3">History</h1>
        <p className="text-sm text-muted-foreground">
          {records.length} {records.length === 1 ? 'PoP' : 'PoPs'}
        </p>
      </div>

      {/* Content */}
      {records.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-6xl mb-6 block">🫧</span>
          <p className="text-muted-foreground mb-6">No PoPs yet</p>
          <Link href={`/pop/${popAddress}`}>
            <Button className="rounded-full">
              <span className="mr-2">🫧</span>
              Create your first PoP
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {records.map((record, index) => (
            <div
              key={`${record.challengeHash}-${index}`}
              className="group rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all bg-card"
            >
              {/* Image */}
              <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                <img
                  src={`${IPFS_GATEWAY}/${record.ipfsCid}`}
                  alt="PoP"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              
              {/* Info */}
              <div className="p-4">
                <div className="text-xs text-muted-foreground">
                  {formatDistanceToNow(Number(record.timestamp) * 1000, { addSuffix: true })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
