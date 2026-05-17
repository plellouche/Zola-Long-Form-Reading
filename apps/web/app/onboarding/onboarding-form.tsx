'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getBrowserApiClient } from '@/lib/api';
import { ApiError } from '@longform/api-client';

type Topic = { id: string; name: string; slug: string; description: string | null };

export function OnboardingForm({ topics }: { topics: Topic[] }) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTopic(id: string) {
    setSelectedTopicIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await getBrowserApiClient().request('/api/users/me/onboarding', {
        method: 'POST',
        body: {
          username: username.trim().toLowerCase(),
          display_name: displayName.trim() || null,
          topic_ids: Array.from(selectedTopicIds),
        },
      });
      router.push('/');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = (err.body as { detail?: string } | null)?.detail;
        setError(detail ?? err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
      setSubmitting(false);
    }
  }

  const canSubmit = username.trim().length >= 3 && selectedTopicIds.size > 0 && !submitting;

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-8">
      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Username</span>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. paul"
            pattern="[a-zA-Z0-9_-]{3,30}"
            title="3-30 characters: letters, digits, underscore, hyphen"
            className="mt-1 block w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--foreground))]"
          />
          <span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">
            3-30 chars. Lowercase letters, digits, underscore, hyphen.
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-medium">Display name (optional)</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Paul Lellouche"
            maxLength={80}
            className="mt-1 block w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--foreground))]"
          />
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Pick at least one topic</legend>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {topics.map((t) => {
            const selected = selectedTopicIds.has(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTopic(t.id)}
                className={
                  'rounded-md border px-3 py-2 text-left text-sm transition ' +
                  (selected
                    ? 'border-[hsl(var(--foreground))] bg-[hsl(var(--foreground))] text-[hsl(var(--background))]'
                    : 'border-[hsl(var(--border))] hover:border-[hsl(var(--foreground))]')
                }
              >
                {t.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-md bg-[hsl(var(--foreground))] px-4 py-2 text-sm font-medium text-[hsl(var(--background))] disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Continue'}
        </button>
        {error && (
          <p className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
