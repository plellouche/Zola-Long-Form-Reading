import Link from 'next/link';

import { ArticleCard } from '@/components/article-card';
import { EmptyState } from '@/components/empty-state';
import { SearchInput } from '@/components/search-input';
import { getServerApiClient } from '@/lib/server-api';
import type { SearchResponse } from '@/lib/api-types';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = '' } = await searchParams;
  const term = q.trim();

  let result: SearchResponse | null = null;
  if (term) {
    result = await getServerApiClient().request<SearchResponse>('/api/search', {
      query: { q: term },
    });
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
        Articles by title, author, or description. Users by username or display name.
      </p>

      <div className="mt-4">
        <SearchInput initialQuery={term} autoFocus />
      </div>

      {!term ? null : !result || (result.articles.length === 0 && result.users.length === 0) ? (
        <div className="mt-10">
          <EmptyState
            title={`No matches for "${term}".`}
            body="Try a broader query or browse by topic."
            cta={{ label: 'Browse topics', href: '/browse' }}
          />
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {result.users.length > 0 && (
            <section>
              <h2 className="text-sm font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                People · {result.users.length}
              </h2>
              <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {result.users.map((u) => (
                  <li key={u.id}>
                    <Link
                      href={`/u/${u.username}`}
                      className="block rounded-lg border border-[hsl(var(--border))] p-3 hover:border-[hsl(var(--foreground))]"
                    >
                      <div className="font-medium">{u.display_name ?? `@${u.username}`}</div>
                      <div className="text-xs text-[hsl(var(--muted-foreground))]">
                        @{u.username}
                      </div>
                      {u.bio && (
                        <p className="mt-1 line-clamp-2 text-sm text-[hsl(var(--muted-foreground))]">
                          {u.bio}
                        </p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.articles.length > 0 && (
            <section>
              <h2 className="text-sm font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Articles · {result.articles.length}
              </h2>
              <div className="mt-3 columns-1 gap-4 sm:columns-2 lg:columns-3">
                {result.articles.map((a) => (
                  <ArticleCard key={a.id} article={a} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
