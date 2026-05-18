import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ArticleCard } from '@/components/article-card';
import { getUser } from '@/lib/auth';
import { getServerApiClient } from '@/lib/server-api';
import type { ActivityItem } from '@/lib/api-types';
import { ApiError } from '@longform/api-client';

type ProfileMe = { username: string | null; onboarded_at: string | null };

async function getActivityFeed(): Promise<ActivityItem[]> {
  try {
    return await getServerApiClient().request<ActivityItem[]>('/api/me/feed/activity', {
      query: { limit: '12' },
    });
  } catch (err) {
    if (err instanceof ApiError) return [];
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

  let activity: ActivityItem[] = [];
  if (user) {
    let profile: ProfileMe | null = null;
    try {
      profile = await getServerApiClient().request<ProfileMe>('/api/users/me');
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
    }
    if (profile && !profile.onboarded_at) {
      redirect('/onboarding');
    }
    activity = await getActivityFeed();
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      {!user && (
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
          <p className="mt-12 text-sm text-[hsl(var(--muted-foreground))]">
            Personalized recommendations land in Phase 7. For now, the library is curated by hand.
          </p>
        </section>
      )}

      {user && (
        <>
          <header className="flex items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">From people you follow</h1>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                Recent saves and list additions from your social graph.
              </p>
            </div>
            <Link
              href="/browse"
              className="rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm hover:border-[hsl(var(--foreground))]"
            >
              Browse all
            </Link>
          </header>

          {activity.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-[hsl(var(--border))] p-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
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
        </>
      )}
    </main>
  );
}
