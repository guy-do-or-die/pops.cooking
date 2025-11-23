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
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-12 flex items-center justify-between">
        <Link href={`/pop/${popAddress}`}>
          <Button variant="ghost" size="sm" className="rounded-full font-medium">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <Button onClick={loadHistory} variant="ghost" size="sm" className="rounded-full">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Title */}
      <div className="mb-12 text-center space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">History</h1>
        <p className="text-base text-muted-foreground">
          {records.length} {records.length === 1 ? 'PoP' : 'PoPs'}
        </p>
      </div>

      {/* Content */}
      {records.length === 0 ? (
        <div className="text-center py-20">
          <span className="text-7xl mb-8 block leading-none">🫧</span>
          <p className="text-lg text-muted-foreground mb-8 leading-relaxed">No PoPs yet</p>
          <Link href={`/pop/${popAddress}`}>
            <Button className="rounded-full px-8 py-6 text-base font-semibold shadow-lg hover:shadow-xl transition-all">
              <span className="mr-2 text-xl">🫧</span>
              Create your first PoP
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {records.map((record, index) => (
            <div
              key={`${record.challengeHash}-${index}`}
              className="group rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all bg-card ring-1 ring-black/5"
            >
              {/* Image */}
              <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                <img
                  src={`${IPFS_GATEWAY}/${record.ipfsCid}`}
                  alt="PoP"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              
              {/* Info */}
              <div className="p-5">
                <div className="text-sm text-muted-foreground tracking-tight">
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
