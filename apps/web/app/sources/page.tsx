import type { Metadata } from 'next';
import Link from 'next/link';

import { getServerApiClient } from '@/lib/server-api';
import type { SourceBrief } from '@/lib/api-types';

type SourceListItem = {
  id: string;
  slug: string;
  name: string;
  homepage_url: string;
  kind: string;
  article_count: number;
  is_active: boolean;
};

export const metadata: Metadata = {
  title: 'Sources',
  description:
    'The publications Zola curates: essays, reporting, criticism, and the occasional dispatch from the web at large.',
  openGraph: { title: 'Sources · Zola', type: 'website' },
};

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default async function PublicSourcesPage() {
  const sources = await getServerApiClient().request<SourceListItem[]>(
    '/api/sources',
    { query: { active: 'true' } },
  );

  // Sort by article count desc, then name — surfaces the most populated first.
  const ranked = sources
    .filter((s) => s.is_active)
    .sort(
      (a, b) =>
        b.article_count - a.article_count || a.name.localeCompare(b.name),
    );

  const totalArticles = ranked.reduce((acc, s) => acc + s.article_count, 0);

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <p className="font-display text-2xl text-[hsl(var(--primary))]">Zola</p>
      <h1 className="mt-4 font-serif text-4xl font-medium leading-tight tracking-tight sm:text-5xl">
        Sources
      </h1>
      <p className="mt-4 max-w-2xl font-serif text-lg leading-relaxed text-[hsl(var(--muted-foreground))]">
        Zola pulls from {ranked.length} publications. {totalArticles.toLocaleString()}{' '}
        essays, features, and criticism are currently in the library, with more
        added every few hours.
      </p>

      <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ranked.map((s) => (
          <li key={s.id}>
            <Link
              href={`/source/${s.slug}`}
              className="block rounded-lg border border-[hsl(var(--border))] p-4 transition motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md hover:border-[hsl(var(--foreground))]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-serif text-xl font-medium leading-snug">
                    {s.name}
                  </h2>
                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                    {hostOf(s.homepage_url)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[hsl(var(--accent))]/15 px-2 py-0.5 text-xs font-medium text-[hsl(var(--accent))]">
                  {s.article_count}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-10 max-w-2xl text-sm text-[hsl(var(--muted-foreground))]">
        Every source links out to the original publication. Zola never hosts or
        paraphrases — we point you toward writers and give them the click. See{' '}
        <Link href="/about" className="underline hover:text-[hsl(var(--foreground))]">
          About
        </Link>{' '}
        for the curation philosophy.
      </p>
    </main>
  );
}
