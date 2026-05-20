import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ForkButton } from './fork-button';
import { ListItemRow } from './list-item-row';
import { ListSettings } from './list-settings';
import { ArticleCard } from '@/components/article-card';
import { getUser } from '@/lib/auth';
import { getSavedArticleIds } from '@/lib/me';
import { getServerApiClient } from '@/lib/server-api';
import type { ArticleSummary, ReadingListDetail } from '@/lib/api-types';
import { ApiError } from '@longform/api-client';

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUser();
  const api = getServerApiClient();

  let list: ReadingListDetail;
  try {
    list = await api.request<ReadingListDetail>(`/api/lists/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const isOwner = !!user && user.id === list.user_id;
  const items = list.items;

  const [suggestions, savedIds] = await Promise.all([
    items.length > 0
      ? api
          .request<ArticleSummary[]>(`/api/lists/${id}/recommendations`, { query: { limit: '6' } })
          .catch((err) => {
            if (err instanceof ApiError) return [] as ArticleSummary[];
            throw err;
          })
      : Promise.resolve<ArticleSummary[]>([]),
    user ? getSavedArticleIds() : Promise.resolve<string[]>([]),
  ]);
  const savedSet = new Set(savedIds);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <Link href={isOwner ? '/lists' : '/browse'} className="text-sm text-[hsl(var(--muted-foreground))]">
        ← Back
      </Link>

      <header className="mt-3">
        <h1 className="text-3xl font-semibold tracking-tight">{list.title}</h1>
        {list.description && (
          <p className="mt-2 text-[hsl(var(--muted-foreground))]">{list.description}</p>
        )}
        <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">
          {list.is_public ? 'Public list' : 'Private list'} · {items.length}{' '}
          {items.length === 1 ? 'article' : 'articles'} · Updated{' '}
          {new Date(list.updated_at).toLocaleDateString()}
        </p>
      </header>

      <div className="mt-4 flex flex-wrap gap-2">
        {isOwner && <ListSettings list={list} />}
        {!isOwner && user && list.is_public && (
          <ForkButton listId={list.id} />
        )}
      </div>

      <ol className="mt-6 space-y-3">
        {items.length === 0 ? (
          <li className="rounded-lg border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
            No articles in this list yet.
            {isOwner && (
              <>
                {' '}
                Add some from any article page using the &ldquo;Add to list&rdquo; button.
              </>
            )}
          </li>
        ) : (
          items.map((it, idx) => (
            <ListItemRow
              key={it.article.id}
              listId={list.id}
              item={it}
              position={idx + 1}
              total={items.length}
              canEdit={isOwner}
            />
          ))
        )}
      </ol>

      {suggestions.length > 0 && (
        <section className="mt-16">
          <h2 className="text-lg font-semibold tracking-tight">Suggested for this list</h2>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            Articles whose topics overlap with what&rsquo;s already here.
          </p>
          <div className="mt-4 columns-1 gap-4 sm:columns-2">
            {suggestions.map((a) => (
              <ArticleCard
                key={a.id}
                article={a}
                showSave={!!user}
                initiallySaved={savedSet.has(a.id)}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
