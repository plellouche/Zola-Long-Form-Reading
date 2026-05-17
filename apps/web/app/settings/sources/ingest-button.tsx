'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getBrowserApiClient } from '@/lib/api';
import { ApiError } from '@longform/api-client';

type Status = 'idle' | 'queueing' | 'queued' | 'error';

export function IngestButton({ sourceId }: { sourceId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setStatus('queueing');
    setError(null);
    try {
      await getBrowserApiClient().request(`/api/admin/sources/${sourceId}/ingest`, {
        method: 'POST',
        body: {},
      });
      setStatus('queued');
      // Give the background task ~3s to land, then refresh the page data.
      setTimeout(() => {
        router.refresh();
        setStatus('idle');
      }, 3000);
    } catch (err) {
      setStatus('error');
      if (err instanceof ApiError) {
        const detail = (err.body as { detail?: string } | null)?.detail;
        setError(detail ?? err.message);
      } else {
        setError('Failed to queue');
      }
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleClick}
        disabled={status === 'queueing' || status === 'queued'}
        className="rounded-md border border-[hsl(var(--border))] px-2 py-1 text-xs hover:border-[hsl(var(--foreground))] disabled:opacity-50"
      >
        {status === 'queueing' ? 'Queuing…' : status === 'queued' ? 'Queued ✓' : 'Ingest now'}
      </button>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </div>
  );
}
