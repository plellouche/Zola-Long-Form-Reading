import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ArticleCard } from '@/components/article-card';
import { EmptyState } from '@/components/empty-state';
import { FeaturedArticleCard } from '@/components/featured-article-card';
import { getUser } from '@/lib/auth';
import { getSavedArticleIds } from '@/lib/me';
import { getServerApiClient } from '@/lib/server-api';
import type { ActivityItem, ArticleSummary } from '@/lib/api-types';
import { ApiError } from '@longform/api-client';

type ProfileMe = { username: string | null; onboarded_at: string | null };

async function safeFetch<T>(
  path: string,
  query: Record<string, string> | undefined,
  fallback: T,
): Promise<T> {
  try {
    return await getServerApiClient().request<T>(path, query ? { query } : undefined);
  } catch (err) {
    if (err instanceof ApiError) return fallback;
    throw err;
  }
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default async function HomePage() {
  const user = await getUser();

  if (!user) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <section className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight">
            Discover long-form essays worth your time.
          </h1>
          <p className="mt-4 text-lg text-[hsl(var(--muted-foreground))]">
            A high-signal library of essays, trip reports, and literary nonfiction. Save what you
            mean to read. Build lists. Follow people whose taste you trust.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/browse"
              className="rounded-md bg-[hsl(var(--foreground))] px-4 py-2 text-sm font-medium text-[hsl(var(--background))]"
            >
              Browse articles
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-[hsl(var(--border))] px-4 py-2 text-sm font-medium"
            >
              Sign in
            </Link>
          </div>
        </section>
      </main>
    );
  }

  // Signed in: gate onboarding, then fetch feed + activity in parallel.
  const profile = await safeFetch<ProfileMe | null>(
    '/api/users/me',
    undefined,
    null,
  );
  if (profile && !profile.onboarded_at) {
    redirect('/onboarding');
  }

  const [forYou, activity, savedIds] = await Promise.all([
    safeFetch<ArticleSummary[]>('/api/feed', { limit: '12' }, []),
    safeFetch<ActivityItem[]>('/api/me/feed/activity', { limit: '12' }, []),
    getSavedArticleIds(),
  ]);
  const savedSet = new Set(savedIds);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <section>
        <header className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">For you</h1>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              Scored on your saves, finishes, and topic picks.
            </p>
          </div>
          <Link
            href="/browse"
            className="rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm hover:border-[hsl(var(--foreground))]"
          >
            Browse all
          </Link>
        </header>
        {forYou.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="Tell us what you like."
              body="Swipe through Discover, or pick more topic interests from onboarding, and your feed will fill in."
              cta={{ label: 'Open Discover', href: '/discover' }}
            />
          </div>
        ) : (
          <>
            <div className="mt-6">
              <FeaturedArticleCard
                article={forYou[0]}
                showSave
                initiallySaved={savedSet.has(forYou[0].id)}
              />
            </div>
            <div className="mt-2 columns-1 gap-4 sm:columns-2 lg:columns-3">
              {forYou.slice(1).map((a) => (
                <ArticleCard
                  key={a.id}
                  article={a}
                  showSave
                  initiallySaved={savedSet.has(a.id)}
                />
              ))}
            </div>
          </>
        )}
      </section>

      <section className="mt-16">
        <header>
          <h2 className="text-xl font-semibold tracking-tight">From people you follow</h2>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Recent saves and list additions from your social graph.
          </p>
        </header>
        {activity.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
            Nothing here yet. Follow some users from their profiles, and their recent saves will
            show up here.
          </div>
        ) : (
          <div className="mt-6 columns-1 gap-4 sm:columns-2 lg:columns-3">
            {activity.map((item) => (
              <div key={item.event_id} className="mb-4 break-inside-avoid">
                <div className="px-1 pb-2 text-xs text-[hsl(var(--muted-foreground))]">
                  <Link href={`/u/${item.actor.username}`} className="hover:underline">
                    @{item.actor.username}
                  </Link>{' '}
                  {item.event_type === 'LIST_ADD' ? 'added' : 'saved'} · {relTime(item.created_at)}
                </div>
                <ArticleCard article={item.article} />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
