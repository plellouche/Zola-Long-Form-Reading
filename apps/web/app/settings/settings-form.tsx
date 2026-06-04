'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getBrowserApiClient } from '@/lib/api';
import { ApiError } from '@longform/api-client';

type Status = 'idle' | 'saving' | 'saved' | 'error';

export function SettingsForm({
  initialDisplayName,
  initialBio,
  initialDiscoverable,
}: {
  initialDisplayName: string;
  initialBio: string;
  initialDiscoverable: boolean;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [bio, setBio] = useState(initialBio);
  const [discoverable, setDiscoverable] = useState(initialDiscoverable);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('saving');
    setError(null);

    try {
      await getBrowserApiClient().request('/api/users/me', {
        method: 'PATCH',
        body: {
          display_name: displayName.trim() || null,
          bio: bio.trim() || null,
          discoverable,
        },
      });
      setStatus('saved');
      router.refresh();
    } catch (err) {
      setStatus('error');
      if (err instanceof ApiError) {
        const detail = (err.body as { detail?: string } | null)?.detail;
        setError(detail ?? err.message);
      } else {
        setError('Something went wrong.');
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Display name</span>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={80}
          className="mt-1 block w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--foreground))]"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Bio</span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          maxLength={500}
          className="mt-1 block w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--foreground))]"
        />
      </label>

      <label className="flex items-start gap-3 rounded-md border border-[hsl(var(--border))] p-3">
        <input
          type="checkbox"
          checked={discoverable}
          onChange={(e) => setDiscoverable(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span className="text-sm">
          <span className="font-medium">List me in the user directory</span>
          <span className="mt-0.5 block text-xs text-[hsl(var(--muted-foreground))]">
            Off by default. Turn this on to be discoverable on{' '}
            <code>/users</code> — other signed-in readers can find and follow
            you. Your <code>/u/{'{username}'}</code> page stays accessible to
            anyone who knows the URL either way.
          </span>
        </span>
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === 'saving'}
          className="rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-50"
        >
          {status === 'saving' ? 'Saving…' : 'Save'}
        </button>
        {status === 'saved' && (
          <span className="text-sm text-[hsl(var(--muted-foreground))]">Saved.</span>
        )}
      </div>

      {error && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}
