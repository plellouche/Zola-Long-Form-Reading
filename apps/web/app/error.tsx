'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Route error:', error);
  }, [error]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
        {error.message || 'An unexpected error occurred. Try refreshing the page.'}
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))]"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-md border border-[hsl(var(--border))] px-4 py-2 text-sm font-medium"
        >
          Go home
        </Link>
      </div>
      {error.digest && (
        <p className="mt-8 text-xs text-[hsl(var(--muted-foreground))]">Digest: {error.digest}</p>
      )}
    </main>
  );
}
