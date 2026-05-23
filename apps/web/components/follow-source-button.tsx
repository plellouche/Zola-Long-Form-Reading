'use client';

import { useState, useTransition } from 'react';

import { useToast } from '@/components/toast';
import { getBrowserApiClient } from '@/lib/api';
import { ApiError } from '@longform/api-client';

type Props = {
  slug: string;
  initiallyFollowing: boolean;
};

export function FollowSourceButton({ slug, initiallyFollowing }: Props) {
  const toast = useToast();
  const [following, setFollowing] = useState(initiallyFollowing);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    const next = !following;
    setFollowing(next);
    startTransition(async () => {
      try {
        await getBrowserApiClient().request(`/api/sources/${slug}/follow`, {
          method: next ? 'POST' : 'DELETE',
        });
        toast.show(next ? 'Following source' : 'Unfollowed source', {
          kind: next ? 'success' : 'info',
        });
      } catch (err) {
        setFollowing(!next);
        const detail =
          err instanceof ApiError
            ? ((err.body as { detail?: string } | null)?.detail ?? err.message)
            : 'Could not update follow.';
        setError(detail);
        toast.show(detail, { kind: 'error' });
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={following}
        className={
          following
            ? 'rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm hover:bg-[hsl(var(--muted))] disabled:opacity-50'
            : 'rounded-md bg-[hsl(var(--primary))] px-3 py-1.5 text-sm font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-50'
        }
      >
        {following ? 'Following' : 'Follow source'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
