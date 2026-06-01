'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { getBrowserApiClient } from '@/lib/api';
import { ApiError } from '@longform/api-client';

export function ForkButton({ listId }: { listId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function fork() {
    setError(null);
    startTransition(async () => {
      try {
        const out = await getBrowserApiClient().request<{ id: string }>(
          `/api/lists/${listId}/fork`,
          { method: 'POST', body: {} },
        );
        router.push(`/list/${out.id}`);
        router.refresh();
      } catch (err) {
        if (err instanceof ApiError) {
          const detail = (err.body as { detail?: string } | null)?.detail;
          setError(detail ?? err.message);
        } else {
          setError('Failed to fork');
        }
      }
    });
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={fork}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm hover:border-[hsl(var(--foreground))] disabled:opacity-50"
      >
        {pending ? 'Forking…' : 'Fork into my lists'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
