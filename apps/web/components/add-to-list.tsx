'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useToast } from '@/components/toast';
import { getBrowserApiClient } from '@/lib/api';
import type { ReadingList } from '@/lib/api-types';
import { ApiError } from '@longform/api-client';

type Variant = 'pill' | 'icon';

type Props = {
  articleId: string;
  /** 'pill' (default) shows "+ Add to list" text; 'icon' shows a + button for card corners. */
  variant?: Variant;
};

type Mode = 'idle' | 'open';

export function AddToList({ articleId, variant = 'pill' }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('idle');
  const [lists, setLists] = useState<ReadingList[] | null>(null);
  const [busyListId, setBusyListId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Fetch lists lazily on first open
  useEffect(() => {
    if (mode !== 'open' || lists !== null) return;
    (async () => {
      try {
        const data = await getBrowserApiClient().request<ReadingList[]>('/api/lists', {
          query: { mine: 'true' },
        });
        setLists(data);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load lists');
      }
    })();
  }, [mode, lists]);

  // Close on outside click — important for the icon variant on cards.
  useEffect(() => {
    if (mode !== 'open') return;
    function onDown(e: MouseEvent) {
      if (!rootRef.current) return;
      if (rootRef.current.contains(e.target as Node)) return;
      setMode('idle');
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [mode]);

  function toggle(e: React.MouseEvent) {
    // Prevent the parent <Link> on a card from navigating when we open the popover.
    e.preventDefault();
    e.stopPropagation();
    setMode((m) => (m === 'idle' ? 'open' : 'idle'));
  }

  async function addToList(listId: string) {
    const list = lists?.find((l) => l.id === listId);
    setBusyListId(listId);
    setError(null);
    try {
      await getBrowserApiClient().request(`/api/lists/${listId}/items`, {
        method: 'POST',
        body: { article_id: articleId },
      });
      setMode('idle');
      toast.show(`Added to ${list?.title ?? 'list'}`);
      router.refresh();
    } catch (err) {
      const detail =
        err instanceof ApiError
          ? ((err.body as { detail?: string } | null)?.detail ?? err.message)
          : 'Failed to add';
      setError(detail);
      toast.show(detail, { kind: 'error' });
    } finally {
      setBusyListId(null);
    }
  }

  async function createAndAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setError(null);
    const intendedTitle = newTitle.trim();
    try {
      const created = await getBrowserApiClient().request<ReadingList>('/api/lists', {
        method: 'POST',
        body: { title: intendedTitle },
      });
      await getBrowserApiClient().request(`/api/lists/${created.id}/items`, {
        method: 'POST',
        body: { article_id: articleId },
      });
      setNewTitle('');
      // Reset cached lists so the next open re-fetches and shows the new one.
      setLists(null);
      setMode('idle');
      toast.show(`Created “${intendedTitle}” and added article`);
      router.refresh();
    } catch (err) {
      const detail = err instanceof ApiError ? err.message : 'Failed to create list';
      setError(detail);
      toast.show(detail, { kind: 'error' });
    }
  }

  const triggerClass =
    variant === 'icon'
      ? 'inline-flex h-8 w-8 items-center justify-center rounded-md border bg-[hsl(var(--background))]/80 backdrop-blur transition border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--foreground))] hover:text-[hsl(var(--foreground))]'
      : 'inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm hover:border-[hsl(var(--foreground))]';

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={toggle}
        aria-label="Add to list"
        title="Add to list"
        className={triggerClass}
      >
        {variant === 'icon' ? (
          <PlusListIcon />
        ) : (
          <>+ Add to list</>
        )}
      </button>

      {mode === 'open' && (
        <div
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute right-0 top-full z-30 mt-2 w-72 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-2 shadow-lg"
        >
          {lists === null ? (
            <p className="px-2 py-3 text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
          ) : lists.length === 0 ? (
            <p className="px-2 py-2 text-xs text-[hsl(var(--muted-foreground))]">
              You haven&rsquo;t created any lists yet.
            </p>
          ) : (
            <ul className="max-h-60 overflow-y-auto">
              {lists.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void addToList(l.id);
                    }}
                    disabled={busyListId === l.id}
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[hsl(var(--muted))] disabled:opacity-50"
                  >
                    <span className="truncate">{l.title}</span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      {l.item_count}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={createAndAdd} className="mt-2 border-t border-[hsl(var(--border))] pt-2">
            <label className="block px-2 text-xs text-[hsl(var(--muted-foreground))]">
              Or create a new list
            </label>
            <div className="mt-1 flex gap-1 px-2">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="List title"
                maxLength={200}
                className="flex-1 rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--foreground))]"
              />
              <button
                type="submit"
                disabled={!newTitle.trim()}
                className="rounded-md bg-[hsl(var(--primary))] px-2 py-1 text-xs text-[hsl(var(--primary-foreground))] disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </form>

          {error && (
            <p className="mt-2 px-2 text-xs text-red-600">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}

function PlusListIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="3" y1="6" x2="14" y2="6" />
      <line x1="3" y1="12" x2="11" y2="12" />
      <line x1="3" y1="18" x2="11" y2="18" />
      <line x1="18" y1="9" x2="18" y2="21" />
      <line x1="12" y1="15" x2="24" y2="15" />
    </svg>
  );
}
