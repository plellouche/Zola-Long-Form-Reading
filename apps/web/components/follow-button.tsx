'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { useToast } from '@/components/toast';
import { getBrowserApiClient } from '@/lib/api';
import { ApiError } from '@longform/api-client';

type Props = {
  username: string;
  initiallyFollowing: boolean;
};

export function FollowButton({ username, initiallyFollowing }: Props) {
  const router = useRouter();
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
        await getBrowserApiClient().request(`/api/users/${username}/follow`, {
          method: next ? 'POST' : 'DELETE',
        });
        toast.show(next ? `Following @${username}` : `Unfollowed @${username}`, {
          kind: next ? 'success' : 'info',
        });
        router.refresh();
      } catch (err) {
        setFollowing(!next);
        const detail =
          err instanceof ApiError
            ? ((err.body as { detail?: string } | null)?.detail ?? err.message)
            : 'Failed';
        setError(detail);
        toast.show(detail, { kind: 'error' });
      }
    });
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={following}
        className={
          'rounded-md border px-4 py-1.5 text-sm transition disabled:opacity-50 ' +
          (following
            ? 'border-[hsl(var(--border))] hover:border-red-500/40 hover:text-red-600'
            : 'border-[hsl(var(--foreground))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]')
        }
      >
        {following ? 'Following' : 'Follow'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
