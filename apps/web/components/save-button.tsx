'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { getBrowserApiClient } from '@/lib/api';
import { ApiError } from '@longform/api-client';

type Props = {
  articleId: string;
  initiallySaved: boolean;
  /** Style: 'icon' for a small toggle, 'pill' for a labeled button. */
  variant?: 'icon' | 'pill';
};

export function SaveButton({ articleId, initiallySaved, variant = 'icon' }: Props) {
  const router = useRouter();
  const [saved, setSaved] = useState(initiallySaved);
  const [pending, startTransition] = useTransition();

  function toggle(e: React.MouseEvent) {
    // Card-level wrapping <Link> would navigate on click otherwise.
    e.preventDefault();
    e.stopPropagation();
    const next = !saved;
    setSaved(next);
    startTransition(async () => {
      try {
        if (next) {
          await getBrowserApiClient().request(`/api/me/articles/${articleId}/state`, {
            method: 'POST',
            body: { status: 'SAVED' },
          });
        } else {
          await getBrowserApiClient().request(`/api/me/articles/${articleId}/state`, {
            method: 'DELETE',
          });
        }
        router.refresh();
      } catch (err) {
        // Revert on failure
        setSaved((s) => !s);
        if (!(err instanceof ApiError)) throw err;
      }
    });
  }

  if (variant === 'pill') {
    return (
      <button
        onClick={toggle}
        disabled={pending}
        className={
          'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition disabled:opacity-50 ' +
          (saved
            ? 'border-[hsl(var(--foreground))] bg-[hsl(var(--foreground))] text-[hsl(var(--background))]'
            : 'border-[hsl(var(--border))] hover:border-[hsl(var(--foreground))]')
        }
        aria-pressed={saved}
      >
        <BookmarkIcon filled={saved} />
        {saved ? 'Saved' : 'Save'}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? 'Unsave article' : 'Save article'}
      title={saved ? 'Unsave' : 'Save'}
      className={
        'inline-flex h-8 w-8 items-center justify-center rounded-md border bg-[hsl(var(--background))]/80 backdrop-blur transition disabled:opacity-50 ' +
        (saved
          ? 'border-[hsl(var(--foreground))] text-[hsl(var(--foreground))]'
          : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--foreground))] hover:text-[hsl(var(--foreground))]')
      }
    >
      <BookmarkIcon filled={saved} />
    </button>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}
