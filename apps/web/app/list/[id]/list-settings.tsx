'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getBrowserApiClient } from '@/lib/api';
import type { ReadingList } from '@/lib/api-types';
import { ApiError } from '@longform/api-client';

export function ListSettings({ list }: { list: ReadingList }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(list.title);
  const [description, setDescription] = useState(list.description ?? '');
  const [isPublic, setIsPublic] = useState(list.is_public);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await getBrowserApiClient().request(`/api/lists/${list.id}`, {
        method: 'PATCH',
        body: {
          title: title.trim(),
          description: description.trim() || null,
          is_public: isPublic,
        },
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function destroy() {
    if (!confirm(`Delete "${list.title}"? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      await getBrowserApiClient().request(`/api/lists/${list.id}`, { method: 'DELETE' });
      router.push('/lists');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed');
      setBusy(false);
    }
  }

  const inputCls =
    'mt-1 block w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--foreground))]';

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm hover:border-[hsl(var(--foreground))]"
      >
        Edit list
      </button>
    );
  }

  return (
    <form onSubmit={save} className="rounded-lg border border-[hsl(var(--border))] p-4">
      <label className="block">
        <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Title</span>
        <input
          type="text"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputCls}
        />
      </label>
      <label className="mt-3 block">
        <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Description</span>
        <textarea
          maxLength={2000}
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputCls}
        />
      </label>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        Public
      </label>
      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="rounded-md bg-[hsl(var(--foreground))] px-3 py-1.5 text-sm text-[hsl(var(--background))] disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={destroy}
          disabled={busy}
          className="ml-auto rounded-md border border-red-500/40 px-3 py-1.5 text-sm text-red-600 hover:bg-red-500/10 disabled:opacity-50"
        >
          Delete list
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </form>
  );
}
