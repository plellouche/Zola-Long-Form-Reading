'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { getBrowserApiClient } from '@/lib/api';
import type { ListItem, ReadingListDetail } from '@/lib/api-types';
import { ApiError } from '@longform/api-client';

type Props = {
  listId: string;
  item: ListItem;
  position: number;
  total: number;
  canEdit: boolean;
  /** When true, render the row as already-read: muted text, dim image, "Read"
   *  badge. The page component sorts read items to the bottom of the list. */
  isRead?: boolean;
};

export function ListItemRow({
  listId,
  item,
  position,
  total,
  canEdit,
  isRead = false,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function move(direction: -1 | 1) {
    const targetIdx = position - 1 + direction; // current 0-based + step
    if (targetIdx < 0 || targetIdx >= total) return;
    setError(null);
    startTransition(async () => {
      try {
        // Fetch current ordering, swap, send full ordering back.
        const current = await getBrowserApiClient().request<ReadingListDetail>(
          `/api/lists/${listId}`,
        );
        const items = [...current.items];
        const i = items.findIndex((x) => x.article.id === item.article.id);
        if (i < 0) return;
        const j = i + direction;
        if (j < 0 || j >= items.length) return;
        [items[i], items[j]] = [items[j], items[i]];
        const payload = {
          items: items.map((it, idx) => ({ article_id: it.article.id, position: idx })),
        };
        await getBrowserApiClient().request(`/api/lists/${listId}/reorder`, {
          method: 'PUT',
          body: payload,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed');
      }
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      try {
        await getBrowserApiClient().request(
          `/api/lists/${listId}/items/${item.article.id}`,
          { method: 'DELETE' },
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed');
      }
    });
  }

  const a = item.article;
  const date = a.publication_date
    ? new Date(a.publication_date).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <li
      className={`flex items-stretch gap-3 rounded-lg border border-[hsl(var(--border))] p-3 transition ${
        isRead ? 'opacity-55 hover:opacity-80' : ''
      }`}
    >
      <div className="flex w-10 shrink-0 flex-col items-center justify-center text-sm text-[hsl(var(--muted-foreground))]">
        {position}
      </div>
      {a.og_image_url && (
        <Link
          href={`/article/${a.id}`}
          className={`hidden w-32 shrink-0 overflow-hidden rounded-md bg-[hsl(var(--muted))] sm:block ${
            isRead ? 'grayscale' : ''
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={a.og_image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          <span>{a.source.name}</span>
          {isRead && (
            <span className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal">
              Read
            </span>
          )}
        </div>
        <Link
          href={`/article/${a.id}`}
          className={`mt-1 block font-medium leading-snug hover:underline ${
            isRead ? 'text-[hsl(var(--muted-foreground))]' : ''
          }`}
        >
          {a.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
          {a.author && <span>{a.author}</span>}
          {a.author && date && <span>·</span>}
          {date && <span>{date}</span>}
          {a.reading_time_minutes != null && (
            <>
              <span>·</span>
              <span>{a.reading_time_minutes} min</span>
            </>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
      {canEdit && (
        <div className="flex shrink-0 flex-col gap-1 self-center">
          <button
            type="button"
            disabled={pending || position === 1}
            onClick={() => move(-1)}
            className="rounded border border-[hsl(var(--border))] px-2 py-0.5 text-xs disabled:opacity-30"
            aria-label="Move up"
            title="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={pending || position === total}
            onClick={() => move(1)}
            className="rounded border border-[hsl(var(--border))] px-2 py-0.5 text-xs disabled:opacity-30"
            aria-label="Move down"
            title="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={remove}
            className="rounded border border-red-500/40 px-2 py-0.5 text-xs text-red-600 hover:bg-red-500/10 disabled:opacity-30"
            aria-label="Remove from list"
            title="Remove"
          >
            ×
          </button>
        </div>
      )}
    </li>
  );
}
