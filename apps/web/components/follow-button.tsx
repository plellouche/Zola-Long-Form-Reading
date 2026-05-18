'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { getBrowserApiClient } from '@/lib/api';
import { ApiError } from '@longform/api-client';

type Props = {
  username: string;
  initiallyFollowing: boolean;
};

export function FollowButton({ username, initiallyFollowing }: Props) {
  const router = useRouter();
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
        router.refresh();
      } catch (err) {
        setFollowing(!next);
        if (err instanceof ApiError) {
          const detail = (err.body as { detail?: string } | null)?.detail;
          setError(detail ?? err.message);
        } else {
          setError('Failed');
        }
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
            : 'border-[hsl(var(--foreground))] bg-[hsl(var(--foreground))] text-[hsl(var(--background))]')
        }
      >
        {following ? 'Following' : 'Follow'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
