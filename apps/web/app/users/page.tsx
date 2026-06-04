import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Avatar } from '@/components/avatar';
import { EmptyState } from '@/components/empty-state';
import { FollowButton } from '@/components/follow-button';
import { getUser } from '@/lib/auth';
import { getServerApiClient } from '@/lib/server-api';
import type { PublicProfile } from '@/lib/api-types';
import { ApiError } from '@longform/api-client';

export const metadata: Metadata = {
  title: 'Readers',
  description: 'Find other Zola readers to follow.',
  robots: { index: false, follow: false },
};

type SortKey = 'active' | 'newest' | 'name';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'active', label: 'Most active' },
  { key: 'newest', label: 'Newest' },
  { key: 'name', label: 'A–Z' },
];

export default async function UsersDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const viewer = await getUser();
  if (!viewer) redirect('/login?next=/users');

  const sp = await searchParams;
  const sort: SortKey =
    sp.sort === 'newest' || sp.sort === 'name' ? sp.sort : 'active';

  let users: PublicProfile[] = [];
  try {
    users = await getServerApiClient().request<PublicProfile[]>('/api/users', {
      query: { sort, limit: '100' },
    });
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    users = [];
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6">
        <h1 className="font-serif text-4xl font-medium tracking-tight">Readers</h1>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          People who&rsquo;ve opted in to the directory. Find someone to follow,
          or{' '}
          <Link href="/settings" className="underline hover:text-[hsl(var(--foreground))]">
            list yourself
          </Link>
          .
        </p>
      </header>

      <nav className="mb-4 flex items-center gap-1 border-b border-[hsl(var(--border))] text-sm">
        {SORTS.map((s) => {
          const active = s.key === sort;
          return (
            <Link
              key={s.key}
              href={s.key === 'active' ? '/users' : `/users?sort=${s.key}`}
              className={
                'border-b-2 px-3 py-2 transition ' +
                (active
                  ? 'border-[hsl(var(--foreground))] text-[hsl(var(--foreground))]'
                  : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]')
              }
            >
              {s.label}
            </Link>
          );
        })}
      </nav>

      {users.length === 0 ? (
        <EmptyState
          title="Nobody&rsquo;s in the directory yet."
          body="The directory is opt-in — flip the toggle in your settings to be the first."
          cta={{ label: 'Settings', href: '/settings' }}
        />
      ) : (
        <ul className="divide-y divide-[hsl(var(--border))] rounded-lg border border-[hsl(var(--border))]">
          {users.map((p) => {
            const display = p.display_name ?? `@${p.username}`;
            return (
              <li key={p.id} className="flex items-center gap-3 p-4">
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
                    {p.is_self && (
                      <span className="ml-2 text-xs font-normal text-[hsl(var(--accent))]">
                        you
                      </span>
                    )}
                  </Link>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">
                    @{p.username}
                    {p.followers_count > 0 && (
                      <span className="ml-2">
                        · {p.followers_count}{' '}
                        {p.followers_count === 1 ? 'follower' : 'followers'}
                      </span>
                    )}
                  </div>
                  {p.bio && (
                    <p className="mt-1 line-clamp-2 text-sm text-[hsl(var(--muted-foreground))]">
                      {p.bio}
                    </p>
                  )}
                </div>
                {!p.is_self && p.username && (
                  <FollowButton
                    username={p.username}
                    initiallyFollowing={p.am_following}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
