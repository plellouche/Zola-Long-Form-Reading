'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getBrowserApiClient } from '@/lib/api';
import { ApiError } from '@longform/api-client';

export function CreateListForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await getBrowserApiClient().request<{ id: string }>('/api/lists', {
        method: 'POST',
        body: { title: title.trim(), is_public: isPublic },
      });
      setTitle('');
      router.push(`/list/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create');
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-[hsl(var(--border))] p-4"
    >
      <label className="flex flex-1 min-w-[200px] flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">New list title</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          placeholder="e.g. Reading on the Anthropocene"
          className="rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--foreground))]"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
        />
        Public
      </label>
      <button
        type="submit"
        disabled={!title.trim() || submitting}
        className="rounded-md bg-[hsl(var(--foreground))] px-3 py-2 text-sm text-[hsl(var(--background))] disabled:opacity-50"
      >
        {submitting ? 'Creating…' : 'Create list'}
      </button>
      {error && <p className="basis-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
