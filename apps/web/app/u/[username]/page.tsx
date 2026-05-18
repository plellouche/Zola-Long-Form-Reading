import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArticleCard } from '@/components/article-card';
import { FollowButton } from '@/components/follow-button';
import { getUser } from '@/lib/auth';
import { getServerApiClient } from '@/lib/server-api';
import type {
  PublicProfile,
  ReadingList,
  StatefulArticle,
  UserArticleStatus,
} from '@/lib/api-types';
import { ApiError } from '@longform/api-client';

type Tab = 'lists' | 'saved' | 'read';

const TAB_LABELS: Record<Tab, string> = {
  lists: 'Lists',
  saved: 'Saved',
  read: 'Read',
};

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { username } = await params;
  const sp = await searchParams;
  const tab: Tab = sp.tab === 'saved' || sp.tab === 'read' ? sp.tab : 'lists';
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

  // Fetch tab payload
  let lists: ReadingList[] = [];
  let savedItems: StatefulArticle[] = [];
  let readItems: StatefulArticle[] = [];

  if (tab === 'lists') {
    lists = await api.request<ReadingList[]>('/api/lists', {
      query: { username: profile.username },
    });
  } else if (tab === 'saved' && isSelf) {
    savedItems = await api.request<StatefulArticle[]>('/api/me/articles', {
      query: { status: 'SAVED' satisfies UserArticleStatus, limit: '60' },
    });
  } else if (tab === 'read' && isSelf) {
    readItems = await api.request<StatefulArticle[]>('/api/me/articles', {
      query: { status: 'FINISHED' satisfies UserArticleStatus, limit: '60' },
    });
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/" className="text-sm text-[hsl(var(--muted-foreground))]">
        ← Home
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {profile.display_name ?? `@${profile.username}`}
          </h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            @{profile.username}
          </p>
        </div>
        {viewer && !isSelf && (
          <FollowButton
            username={profile.username}
            initiallyFollowing={profile.am_following}
          />
        )}
      </div>

      <div className="mt-3 flex gap-4 text-sm text-[hsl(var(--muted-foreground))]">
        <span>
          <strong className="text-[hsl(var(--foreground))]">{profile.followers_count}</strong>{' '}
          {profile.followers_count === 1 ? 'follower' : 'followers'}
        </span>
        <span>
          <strong className="text-[hsl(var(--foreground))]">{profile.following_count}</strong>{' '}
          following
        </span>
      </div>

      {profile.bio && <p className="mt-6 max-w-2xl whitespace-pre-wrap">{profile.bio}</p>}

      <nav className="mt-8 flex items-center gap-1 border-b border-[hsl(var(--border))]">
        {(['lists', 'saved', 'read'] as Tab[]).map((t) => {
          const visible = t === 'lists' || isSelf;
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
              <div className="rounded-lg border border-dashed border-[hsl(var(--border))] p-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
                No public lists yet.
              </div>
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

        {tab === 'saved' && isSelf && (
          <>
            {savedItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[hsl(var(--border))] p-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
                Nothing saved yet.
              </div>
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
              <div className="rounded-lg border border-dashed border-[hsl(var(--border))] p-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
                Nothing finished yet. Mark articles as finished on the article page to build your read history.
              </div>
            ) : (
              <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
                {readItems.map((it) => (
                  <ArticleCard key={it.article.id} article={it.article} />
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
