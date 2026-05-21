import type { Metadata } from 'next';

import { DiscoverDeck } from '@/components/discover-deck';
import { requireUser } from '@/lib/auth';
import { getServerApiClient } from '@/lib/server-api';
import type { ArticleSummary } from '@/lib/api-types';

export const metadata: Metadata = {
  title: 'Discover',
  description: 'Swipe through fresh longform articles to train your feed.',
};

export default async function DiscoverPage() {
  await requireUser();
  const initialDeck = await getServerApiClient().request<ArticleSummary[]>(
    '/api/discover/deck',
    { query: { limit: '25' } },
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Discover</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          Swipe to train your feed.
        </p>
      </header>
      <DiscoverDeck initialDeck={initialDeck} />
    </main>
  );
}
