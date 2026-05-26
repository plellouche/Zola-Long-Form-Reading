'use client';

import { useCallback, useEffect, useState } from 'react';

import { getBrowserApiClient } from '@/lib/api';
import type { ArticleSummary } from '@/lib/api-types';
import { ApiError } from '@longform/api-client';

type Props = {
  /** The article the user just rated; the prompt asks "this vs <other>". */
  articleId: string;
  articleTitle: string;
  /** Re-run when the parent's rating changes so we fetch a fresh candidate
   *  scoped to the new tier. */
  rating: 'LOVED' | 'LIKED' | 'OK' | null;
};

/**
 * Two-button pairwise prompt that appears after a rating is set. Lets the
 * user produce ranking signal one click at a time. Chains: after a vote,
 * fetches the next candidate from the API and re-renders.
 *
 * Hides itself silently when the API returns no candidate (first rating,
 * or every same-tier article already compared).
 */
export function ComparePrompt({ articleId, articleTitle, rating }: Props) {
  const [candidate, setCandidate] = useState<ArticleSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hidden, setHidden] = useState(false);

  const fetchCandidate = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getBrowserApiClient().request<ArticleSummary | null>(
        `/api/me/articles/${articleId}/compare-candidate`,
      );
      setCandidate(next);
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      setCandidate(null);
    } finally {
      setLoading(false);
    }
  }, [articleId]);

  useEffect(() => {
    if (rating === null) {
      setCandidate(null);
      return;
    }
    void fetchCandidate();
  }, [rating, fetchCandidate]);

  async function vote(winnerId: string) {
    if (!candidate) return;
    setSubmitting(true);
    try {
      const next = await getBrowserApiClient().request<ArticleSummary | null>(
        `/api/me/articles/${articleId}/compare`,
        {
          method: 'POST',
          body: { other_id: candidate.id, winner_id: winnerId },
        },
      );
      setCandidate(next);
    } catch {
      // Silent on failure; user can ignore the prompt.
    } finally {
      setSubmitting(false);
    }
  }

  if (hidden || rating === null) return null;
  if (loading && !candidate) return null;
  if (!candidate) return null;

  return (
    <div className="mt-4 rounded-md border border-dashed border-[hsl(var(--accent))]/40 bg-[hsl(var(--accent))]/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Quick — which did you prefer? Builds your personal ranking.
        </p>
        <button
          type="button"
          onClick={() => setHidden(true)}
          className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          aria-label="Hide comparison prompt"
        >
          ✕
        </button>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => vote(articleId)}
          disabled={submitting}
          className="rounded-md border border-[hsl(var(--border))] p-3 text-left text-sm transition hover:border-[hsl(var(--foreground))] disabled:opacity-50"
        >
          <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            This one
          </div>
          <div className="mt-1 line-clamp-2 font-medium">{articleTitle}</div>
        </button>
        <button
          type="button"
          onClick={() => vote(candidate.id)}
          disabled={submitting}
          className="rounded-md border border-[hsl(var(--border))] p-3 text-left text-sm transition hover:border-[hsl(var(--foreground))] disabled:opacity-50"
        >
          <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            {candidate.source.name}
          </div>
          <div className="mt-1 line-clamp-2 font-medium">{candidate.title}</div>
        </button>
      </div>
    </div>
  );
}
