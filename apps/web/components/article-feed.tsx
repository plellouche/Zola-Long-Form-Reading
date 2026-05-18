'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ArticleCard } from '@/components/article-card';
import { getBrowserApiClient } from '@/lib/api';
import type { ArticleListResponse, ArticleSummary } from '@/lib/api-types';
import { ApiError } from '@longform/api-client';

type Props = {
  /** Initial page rendered server-side. */
  initial: ArticleListResponse;
  /** Query params (besides `cursor`) to forward when loading more. */
  query: Record<string, string>;
};

/**
 * Masonry-style infinite-scroll feed. CSS column layout (no JS library)
 * + IntersectionObserver to trigger the next page when the sentinel scrolls
 * into view.
 */
export function ArticleFeed({ initial, query }: Props) {
  const [items, setItems] = useState<ArticleSummary[]>(initial.items);
  const [cursor, setCursor] = useState<string | null>(initial.next_cursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Reset when the query changes (e.g., filter or search input changed)
  const queryKey = JSON.stringify(query);
  const seededRef = useRef(queryKey);

  useEffect(() => {
    if (seededRef.current === queryKey) return;
    seededRef.current = queryKey;
    setItems(initial.items);
    setCursor(initial.next_cursor);
    setError(null);
  }, [queryKey, initial]);

  const loadMore = useCallback(async () => {
    if (loading || !cursor) return;
    setLoading(true);
    setError(null);
    try {
      const next = await getBrowserApiClient().request<ArticleListResponse>('/api/articles', {
        query: { ...query, cursor },
      });
      setItems((prev) => [...prev, ...next.items]);
      setCursor(next.next_cursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load more');
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, query]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !cursor) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: '600px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [cursor, loadMore]);

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[hsl(var(--border))] p-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
        No articles match these filters.
      </div>
    );
  }

  return (
    <>
      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
        {items.map((a) => (
          <ArticleCard key={a.id} article={a} />
        ))}
      </div>
      <div ref={sentinelRef} className="h-8" />
      {loading && (
        <p className="py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
      )}
      {!cursor && items.length > 0 && (
        <p className="py-4 text-center text-xs text-[hsl(var(--muted-foreground))]">End of feed.</p>
      )}
      {error && (
        <p className="py-4 text-center text-sm text-red-600">{error}</p>
      )}
    </>
  );
}
