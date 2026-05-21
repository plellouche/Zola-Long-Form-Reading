'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { getBrowserApiClient } from '@/lib/api';
import type { UserArticleStatus } from '@/lib/api-types';
import { ApiError } from '@longform/api-client';

type Props = {
  articleId: string;
  initialStatus: UserArticleStatus | null;
};

const ORDER: UserArticleStatus[] = ['SAVED', 'READING', 'FINISHED', 'DISMISSED'];
const LABELS: Record<UserArticleStatus, string> = {
  SAVED: 'Save',
  READING: 'Reading',
  FINISHED: 'Finished',
  DISMISSED: 'Dismiss',
  INTERESTED: 'Interested',
};

export function ArticleStateControls({ articleId, initialStatus }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<UserArticleStatus | null>(initialStatus);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function setTo(target: UserArticleStatus) {
    setError(null);
    const newStatus: UserArticleStatus | null = status === target ? null : target;
    setStatus(newStatus);
    startTransition(async () => {
      try {
        if (newStatus === null) {
          await getBrowserApiClient().request(`/api/me/articles/${articleId}/state`, {
            method: 'DELETE',
          });
        } else {
          await getBrowserApiClient().request(`/api/me/articles/${articleId}/state`, {
            method: 'POST',
            body: { status: newStatus },
          });
        }
        router.refresh();
      } catch (err) {
        // Revert
        setStatus(status);
        setError(err instanceof ApiError ? err.message : 'Failed');
      }
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {ORDER.map((s) => {
          const active = status === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setTo(s)}
              disabled={pending}
              className={
                'rounded-md border px-3 py-1.5 text-sm transition disabled:opacity-50 ' +
                (active
                  ? 'border-[hsl(var(--foreground))] bg-[hsl(var(--foreground))] text-[hsl(var(--background))]'
                  : 'border-[hsl(var(--border))] hover:border-[hsl(var(--foreground))]')
              }
            >
              {LABELS[s]}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
