import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArticleCard } from '@/components/article-card';
import { Avatar } from '@/components/avatar';
import { EmptyState } from '@/components/empty-state';
import { FollowButton } from '@/components/follow-button';
import { ProfileStatsCard } from '@/components/profile-stats-card';
import { getUser } from '@/lib/auth';
import { getServerApiClient } from '@/lib/server-api';
import type {
  ArticleSummary,
  ProfileStats,
  PublicProfile,
  ReadingList,
  StatefulArticle,
  UserArticleStatus,
} from '@/lib/api-types';
import { ApiError } from '@longform/api-client';

type Tab = 'lists' | 'top' | 'saved' | 'read' | 'interested';

const TAB_LABELS: Record<Tab, string> = {
  lists: 'Lists',
  top: 'Top',
  saved: 'Saved',
  read: 'Read',
  interested: 'Interested',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  try {
    const profile = await getServerApiClient().request<{
      username: string;
      display_name: string | null;
      bio: string | null;
    }>(`/api/users/${username}`);
    const displayName = profile.display_name ?? `@${profile.username}`;
    return {
      title: displayName,
      description: profile.bio ?? `${displayName}'s public lists and reading on Zola.`,
      openGraph: { title: displayName, description: profile.bio ?? '', type: 'profile' },
    };
  } catch {
    return { title: 'Profile' };
  }
}

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { username } = await params;
  const sp = await searchParams;
  const requested = sp.tab;
  const tab: Tab =
    requested === 'top' ||
    requested === 'saved' ||
    requested === 'read' ||
    requested === 'interested'
      ? requested
      : 'lists';
  const api = getServerApiClient();

  let profile: PublicProfile;
  try {
    profile = await api.request<PublicProfile>(`/api/users/${username}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const viewer = await getUser();
  const isSelf = profile.is_self;

  // Stats: fail-soft. If the API errors, just hide the card.
  const stats = await api
    .request<ProfileStats>(`/api/users/${profile.username}/stats`)
    .catch((err) => {
      if (err instanceof ApiError) return null;
      throw err;
    });

  // Fetch tab payload
  let lists: ReadingList[] = [];
  let savedItems: StatefulArticle[] = [];
  let readItems: StatefulArticle[] = [];
  let interestedItems: StatefulArticle[] = [];
  let topRated: ArticleSummary[] = [];

  if (tab === 'lists') {
    lists = await api.request<ReadingList[]>('/api/lists', {
      query: { username: profile.username },
    });
  } else if (tab === 'top') {
    // Public: anyone can see anyone's top-rated. The endpoint orders by
    // LOVED -> LIKED -> OK, recency tiebreak within each tier.
    topRated = await api
      .request<ArticleSummary[]>(`/api/users/${profile.username}/top-rated`, {
        query: { limit: '30' },
      })
      .catch((err) => {
        if (err instanceof ApiError) return [] as ArticleSummary[];
        throw err;
      });
  } else if (tab === 'saved' && isSelf) {
    savedItems = await api.request<StatefulArticle[]>('/api/me/articles', {
      query: { status: 'SAVED' satisfies UserArticleStatus, limit: '60' },
    });
  } else if (tab === 'read' && isSelf) {
    readItems = await api.request<StatefulArticle[]>('/api/me/articles', {
      query: { status: 'FINISHED' satisfies UserArticleStatus, limit: '60' },
    });
  } else if (tab === 'interested' && isSelf) {
    interestedItems = await api.request<StatefulArticle[]>('/api/me/articles', {
      query: { status: 'INTERESTED' satisfies UserArticleStatus, limit: '100' },
    });
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/" className="text-sm text-[hsl(var(--muted-foreground))]">
        ← Home
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-4">
          <Avatar
            src={profile.avatar_url}
            name={profile.display_name ?? profile.username}
            seed={profile.id}
            size="xl"
          />
          <div>
            <h1 className="font-serif text-4xl font-medium tracking-tight">
              {profile.display_name ?? `@${profile.username}`}
            </h1>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              @{profile.username}
            </p>
          </div>
        </div>
        {viewer && !isSelf && (
          <FollowButton
            username={profile.username}
            initiallyFollowing={profile.am_following}
          />
        )}
      </div>

      <div className="mt-3 flex gap-4 text-sm text-[hsl(var(--muted-foreground))]">
        <Link
          href={`/u/${profile.username}/followers`}
          className="hover:text-[hsl(var(--foreground))]"
        >
          <strong className="text-[hsl(var(--foreground))]">{profile.followers_count}</strong>{' '}
          {profile.followers_count === 1 ? 'follower' : 'followers'}
        </Link>
        <Link
          href={`/u/${profile.username}/following`}
          className="hover:text-[hsl(var(--foreground))]"
        >
          <strong className="text-[hsl(var(--foreground))]">{profile.following_count}</strong>{' '}
          following
        </Link>
      </div>

      {profile.bio && <p className="mt-6 max-w-2xl whitespace-pre-wrap">{profile.bio}</p>}

      {stats && <ProfileStatsCard stats={stats} />}

      <nav className="mt-8 flex items-center gap-1 border-b border-[hsl(var(--border))]">
        {(['lists', 'top', 'saved', 'read', 'interested'] as Tab[]).map((t) => {
          // 'top' is public (it's the personal canon), 'saved/read/interested'
          // remain self-only because they expose private intent signals.
          const visible = t === 'lists' || t === 'top' || isSelf;
          if (!visible) return null;
          const active = t === tab;
          return (
            <Link
              key={t}
              href={`/u/${profile.username}${t === 'lists' ? '' : `?tab=${t}`}`}
              className={
                'border-b-2 px-3 py-2 text-sm transition ' +
                (active
                  ? 'border-[hsl(var(--foreground))] text-[hsl(var(--foreground))]'
                  : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]')
              }
            >
              {TAB_LABELS[t]}
            </Link>
          );
        })}
      </nav>

      <section className="mt-6">
        {tab === 'lists' && (
          <>
            {lists.length === 0 ? (
              <EmptyState
                title={isSelf ? "You haven't built any lists yet." : 'No public lists yet.'}
                body={isSelf ? 'Group articles you love into shareable reading lists.' : undefined}
                cta={isSelf ? { label: 'Create a list', href: '/lists' } : undefined}
              />
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {lists.map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/list/${l.id}`}
                      className="block rounded-lg border border-[hsl(var(--border))] p-4 transition hover:border-[hsl(var(--foreground))]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="font-medium">{l.title}</h2>
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">
                          {l.item_count}
                        </span>
                      </div>
                      {l.description && (
                        <p className="mt-2 line-clamp-2 text-sm text-[hsl(var(--muted-foreground))]">
                          {l.description}
                        </p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === 'top' && (
          <>
            {topRated.length === 0 ? (
              <EmptyState
                title={isSelf ? "You haven't rated anything yet." : 'No ratings yet.'}
                body={
                  isSelf
                    ? 'Finish an article and tap Loved / Liked / OK on its page. Ratings build your personal canon and feed the leaderboard.'
                    : undefined
                }
                cta={isSelf ? { label: 'Browse articles', href: '/browse' } : undefined}
              />
            ) : (
              <>
                <p className="mb-4 text-xs text-[hsl(var(--muted-foreground))]">
                  Ordered Loved → Liked → OK. Most recent rating in each tier first.
                </p>
                <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
                  {topRated.map((a) => (
                    <ArticleCard
                      key={a.id}
                      article={a}
                      showSave={!!viewer}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {tab === 'saved' && isSelf && (
          <>
            {savedItems.length === 0 ? (
              <EmptyState
                title="Nothing saved yet."
                body="Swipe up in Discover or tap save on a card to start building your queue."
                cta={{ label: 'Discover articles', href: '/discover' }}
              />
            ) : (
              <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
                {savedItems.map((it) => (
                  <ArticleCard
                    key={it.article.id}
                    article={it.article}
                    showSave
                    initiallySaved
                  />
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'read' && isSelf && (
          <>
            {readItems.length === 0 ? (
              <EmptyState
                title="No reading history yet."
                body="Mark articles as finished on the article page and they'll appear here, grouped by day."
                cta={{ label: 'Browse all articles', href: '/browse' }}
              />
            ) : (
              <ReadTimeline items={readItems} />
            )}
          </>
        )}

        {tab === 'interested' && isSelf && (
          <>
            {interestedItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[hsl(var(--border))] p-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
                Start swiping to train your feed.{' '}
                <Link href="/discover" className="underline">
                  Open the deck
                </Link>
                .
              </div>
            ) : (
              <>
                <p className="mb-4 text-xs text-[hsl(var(--muted-foreground))]">
                  Private — only you see this. {interestedItems.length} article
                  {interestedItems.length === 1 ? '' : 's'} marked interested.
                </p>
                <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
                  {interestedItems.map((it) => (
                    <ArticleCard key={it.article.id} article={it.article} showSave />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function ReadTimeline({ items }: { items: StatefulArticle[] }) {
  const groups = new Map<string, StatefulArticle[]>();
  for (const it of items) {
    const ref = it.state.finished_at ?? it.state.updated_at;
    const key = ref.slice(0, 10); // YYYY-MM-DD
    const bucket = groups.get(key);
    if (bucket) bucket.push(it);
    else groups.set(key, [it]);
  }
  const dayFmt = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-8">
      {[...groups.entries()].map(([day, dayItems]) => (
        <div key={day}>
          <h3 className="mb-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">
            {day === today ? 'Today' : dayFmt.format(new Date(day))}
            <span className="ml-2 text-xs">
              {dayItems.length} article{dayItems.length === 1 ? '' : 's'}
            </span>
          </h3>
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
            {dayItems.map((it) => (
              <ArticleCard key={it.article.id} article={it.article} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
