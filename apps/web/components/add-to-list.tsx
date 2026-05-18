'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getBrowserApiClient } from '@/lib/api';
import type { ReadingList } from '@/lib/api-types';
import { ApiError } from '@longform/api-client';

type Props = {
  articleId: string;
};

type Mode = 'idle' | 'open' | 'creating';

export function AddToList({ articleId }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('idle');
  const [lists, setLists] = useState<ReadingList[] | null>(null);
  const [busyListId, setBusyListId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');

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

  async function addToList(listId: string) {
    setBusyListId(listId);
    setError(null);
    try {
      await getBrowserApiClient().request(`/api/lists/${listId}/items`, {
        method: 'POST',
        body: { article_id: articleId },
      });
      setMode('idle');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = (err.body as { detail?: string } | null)?.detail;
        setError(detail ?? err.message);
      } else {
        setError('Failed to add');
      }
    } finally {
      setBusyListId(null);
    }
  }

  async function createAndAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setError(null);
    try {
      const created = await getBrowserApiClient().request<ReadingList>('/api/lists', {
        method: 'POST',
        body: { title: newTitle.trim() },
      });
      await getBrowserApiClient().request(`/api/lists/${created.id}/items`, {
        method: 'POST',
        body: { article_id: articleId },
      });
      setNewTitle('');
      setMode('idle');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create list');
    }
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setMode((m) => (m === 'idle' ? 'open' : 'idle'))}
        className="inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm hover:border-[hsl(var(--foreground))]"
      >
        + Add to list
      </button>

      {mode !== 'idle' && (
        <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-2 shadow-lg">
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
                    onClick={() => addToList(l.id)}
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
                placeholder="List title"
                maxLength={200}
                className="flex-1 rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--foreground))]"
              />
              <button
                type="submit"
                disabled={!newTitle.trim()}
                className="rounded-md bg-[hsl(var(--foreground))] px-2 py-1 text-xs text-[hsl(var(--background))] disabled:opacity-50"
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
