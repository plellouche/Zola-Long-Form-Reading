'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { ComparePrompt } from '@/components/compare-prompt';
import { getBrowserApiClient } from '@/lib/api';
import type { UserArticleStatus } from '@/lib/api-types';
import { ApiError } from '@longform/api-client';

type Rating = 'LOVED' | 'LIKED' | 'OK';

type Props = {
  articleId: string;
  articleTitle: string;
  initialStatus: UserArticleStatus | null;
  initialRating?: Rating | null;
};

const ORDER: UserArticleStatus[] = ['SAVED', 'READING', 'FINISHED', 'DISMISSED'];
const LABELS: Record<UserArticleStatus, string> = {
  SAVED: 'Save',
  READING: 'Reading',
  FINISHED: 'Finished',
  DISMISSED: 'Dismiss',
  INTERESTED: 'Interested',
};

const RATING_ORDER: Rating[] = ['LOVED', 'LIKED', 'OK'];
const RATING_LABELS: Record<Rating, string> = {
  LOVED: 'Loved it',
  LIKED: 'Liked it',
  OK: 'It was OK',
};

export function ArticleStateControls({
  articleId,
  articleTitle,
  initialStatus,
  initialRating = null,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<UserArticleStatus | null>(initialStatus);
  const [rating, setRating] = useState<Rating | null>(initialRating);
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

  function rate(target: Rating) {
    setError(null);
    const newRating: Rating | null = rating === target ? null : target;
    const prev = rating;
    setRating(newRating);
    startTransition(async () => {
      try {
        await getBrowserApiClient().request(`/api/me/articles/${articleId}/rating`, {
          method: 'PUT',
          body: { rating: newRating },
        });
        router.refresh();
      } catch (err) {
        setRating(prev);
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
                  ? 'border-[hsl(var(--foreground))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                  : 'border-[hsl(var(--border))] hover:border-[hsl(var(--foreground))]')
              }
            >
              {LABELS[s]}
            </button>
          );
        })}
      </div>

      {status === 'FINISHED' && (
        <div className="mt-4 rounded-md border border-dashed border-[hsl(var(--border))] p-3">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            How was it? Helps build your personal canon.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {RATING_ORDER.map((r) => {
              const active = rating === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => rate(r)}
                  disabled={pending}
                  className={
                    'rounded-md border px-3 py-1 text-sm transition disabled:opacity-50 ' +
                    (active
                      ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))]'
                      : 'border-[hsl(var(--border))] hover:border-[hsl(var(--foreground))]')
                  }
                >
                  {RATING_LABELS[r]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {status === 'FINISHED' && rating !== null && (
        <ComparePrompt
          articleId={articleId}
          articleTitle={articleTitle}
          rating={rating}
        />
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
