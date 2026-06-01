import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Avatar } from '@/components/avatar';
import { EmptyState } from '@/components/empty-state';
import { getUser } from '@/lib/auth';
import { getServerApiClient } from '@/lib/server-api';
import type { LeaderboardEntry, LeaderboardPeriod } from '@/lib/api-types';
import { ApiError } from '@longform/api-client';

export const metadata: Metadata = {
  title: 'Leaderboard',
  description: 'Reading among the people you follow.',
};

type Tab = LeaderboardPeriod;

const TABS: { key: Tab; label: string }[] = [
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'all_time', label: 'All time' },
];

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect('/login?next=/leaderboard');

  const sp = await searchParams;
  const requested = sp.period;
  const period: Tab =
    requested === 'month' || requested === 'all_time' ? requested : 'week';

  const api = getServerApiClient();
  let rows: LeaderboardEntry[] = [];
  try {
    rows = await api.request<LeaderboardEntry[]>('/api/leaderboard/hours', {
      query: { period },
    });
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    rows = [];
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-serif text-4xl font-medium tracking-tight">Leaderboard</h1>
      <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
        Hours read among the people you follow. Time, not article count, so a
        slow read of a long essay counts more than a fast skim.
      </p>

      <nav className="mt-6 flex items-center gap-1 border-b border-[hsl(var(--border))]">
        {TABS.map((t) => {
          const active = period === t.key;
          return (
            <Link
              key={t.key}
              href={t.key === 'week' ? '/leaderboard' : `/leaderboard?period=${t.key}`}
              className={
                'border-b-2 px-3 py-2 text-sm transition ' +
                (active
                  ? 'border-[hsl(var(--foreground))] text-[hsl(var(--foreground))]'
                  : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]')
              }
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <section className="mt-6">
        {rows.length === 0 ? (
          <EmptyState
            title="Nobody on the board yet."
            body="Follow a few readers to compare hours."
            cta={{ label: 'Find people to follow', href: '/browse' }}
          />
        ) : (
          <ol className="space-y-2">
            {rows.map((entry) => {
              const p = entry.profile;
              const me = p.is_self;
              const display = p.display_name ?? `@${p.username}`;
              return (
                <li
                  key={p.id}
                  className={
                    'flex items-center gap-3 rounded-lg border p-3 ' +
                    (me
                      ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/5'
                      : 'border-[hsl(var(--border))]')
                  }
                >
                  <div className="w-8 shrink-0 text-center font-serif text-lg font-medium text-[hsl(var(--muted-foreground))]">
                    {entry.rank}
                  </div>
                  <Link href={`/u/${p.username}`} className="shrink-0">
                    <Avatar
                      src={p.avatar_url}
                      name={display}
                      seed={p.id}
                      size="md"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/u/${p.username}`}
                      className="block truncate font-medium hover:underline"
                    >
                      {display}
                      {me && (
                        <span className="ml-2 text-xs font-normal text-[hsl(var(--accent))]">
                          you
                        </span>
                      )}
                    </Link>
                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                      @{p.username}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-serif text-xl font-medium leading-none">
                      {entry.hours_read >= 10
                        ? Math.round(entry.hours_read)
                        : entry.hours_read.toFixed(1)}
                      <span className="ml-1 text-xs font-normal text-[hsl(var(--muted-foreground))]">
                        hr
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                      {entry.finished_count}{' '}
                      {entry.finished_count === 1 ? 'article' : 'articles'}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}
