import Link from 'next/link';
import { notFound } from 'next/navigation';

import type { Metadata } from 'next';

import { ReadArticleButton } from './read-button';
import { AddToList } from '@/components/add-to-list';
import { ArticleCard } from '@/components/article-card';
import { ArticleStateControls } from '@/components/article-state-controls';
import { getUser } from '@/lib/auth';
import { getSavedArticleIds } from '@/lib/me';
import { getServerApiClient } from '@/lib/server-api';
import type { ArticleSummary, UserArticleState, UserArticleStatus } from '@/lib/api-types';
import { stripHtml } from '@/lib/utils';
import { ApiError } from '@longform/api-client';

type Source = { id: string; slug: string; name: string };
type ArticleTopicLink = { topic_id: string; weight: number };
type Topic = { id: string; slug: string; name: string };

type ArticleDetail = {
  id: string;
  source: Source;
  title: string;
  author: string | null;
  publication_date: string | null;
  canonical_url: string;
  og_image_url: string | null;
  description: string | null;
  reading_time_minutes: number | null;
  word_count: number | null;
  content_policy: 'REDIRECT_ONLY' | 'EMBED_ALLOWED' | 'FULLTEXT_ALLOWED';
  quality_score: number;
  save_count: number;
  finish_count: number;
  topics: ArticleTopicLink[];
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const article = await getServerApiClient().request<{
      title: string;
      description: string | null;
      og_image_url: string | null;
      author: string | null;
      source: { name: string };
    }>(`/api/articles/${id}`);
    const cleanDescription = stripHtml(article.description) || `An article from ${article.source.name}.`;
    return {
      title: article.title,
      description: cleanDescription,
      openGraph: {
        title: article.title,
        description: cleanDescription,
        type: 'article',
        images: article.og_image_url ? [{ url: article.og_image_url }] : undefined,
      },
      twitter: {
        card: 'summary_large_image',
        title: article.title,
        description: cleanDescription,
        images: article.og_image_url ? [article.og_image_url] : undefined,
      },
    };
  } catch {
    return { title: 'Article' };
  }
}

async function getMyStateForArticle(id: string): Promise<UserArticleStatus | null> {
  try {
    const state = await getServerApiClient().request<UserArticleState>(
      `/api/me/articles/${id}/state`,
    );
    return state.status;
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 401)) return null;
    throw err;
  }
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const api = getServerApiClient();
  const user = await getUser();

  let article: ArticleDetail;
  try {
    article = await api.request<ArticleDetail>(`/api/articles/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const [allTopics, myStatus, related, savedIds] = await Promise.all([
    api.request<Topic[]>('/api/topics'),
    user ? getMyStateForArticle(id) : Promise.resolve(null),
    api
      .request<ArticleSummary[]>(`/api/articles/${id}/related`, { query: { limit: '6' } })
      .catch((err) => {
        if (err instanceof ApiError) return [] as ArticleSummary[];
        throw err;
      }),
    user ? getSavedArticleIds() : Promise.resolve<string[]>([]),
  ]);
  const savedSet = new Set(savedIds);
  const topicsById = new Map(allTopics.map((t) => [t.id, t]));
  const articleTopics = article.topics
    .map((link) => topicsById.get(link.topic_id))
    .filter((t): t is Topic => !!t);

  const date = article.publication_date
    ? new Date(article.publication_date).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/browse" className="text-sm text-[hsl(var(--muted-foreground))]">
        ← Browse
      </Link>

      <div className="mt-6 text-[11px] font-medium uppercase tracking-[0.18em] text-[hsl(var(--accent))]">
        <Link href={`/source/${article.source.slug}`} className="hover:text-[hsl(var(--primary))] hover:underline">
          {article.source.name}
        </Link>
      </div>

      <h1 className="mt-3 font-serif text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl">
        {article.title}
      </h1>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[hsl(var(--muted-foreground))]">
        {article.author && (
          <span className="font-serif text-base italic text-[hsl(var(--foreground))]">
            By {article.author}
          </span>
        )}
        {date && <span>{date}</span>}
        {article.reading_time_minutes && (
          <span>{article.reading_time_minutes} min read</span>
        )}
        {article.save_count > 0 && (
          <span>{article.save_count} {article.save_count === 1 ? 'save' : 'saves'}</span>
        )}
      </div>

      {article.og_image_url && (
        <div className="mt-6 aspect-[16/9] overflow-hidden rounded-lg bg-[hsl(var(--muted))]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.og_image_url}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {article.description && (
        <p className="drop-cap mt-8 max-w-prose font-serif text-xl leading-relaxed text-[hsl(var(--foreground))]">
          {stripHtml(article.description)}
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <ReadArticleButton articleId={article.id} url={article.canonical_url} />
        {user && <AddToList articleId={article.id} />}
      </div>

      {user && (
        <section className="mt-8 rounded-lg border border-[hsl(var(--border))] p-4">
          <h2 className="text-sm font-medium">Your state</h2>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            Tracks where this article is for you. Click a label to toggle it off.
          </p>
          <div className="mt-3">
            <ArticleStateControls articleId={article.id} initialStatus={myStatus} />
          </div>
        </section>
      )}

      {articleTopics.length > 0 && (
        <div className="mt-10 flex flex-wrap gap-2">
          {articleTopics.map((t) => (
            <Link
              key={t.id}
              href={`/topics/${t.slug}`}
              className="rounded-full border border-[hsl(var(--border))] px-3 py-1 text-xs hover:border-[hsl(var(--foreground))]"
            >
              {t.name}
            </Link>
          ))}
        </div>
      )}

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="text-lg font-semibold tracking-tight">Related</h2>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            Other articles with overlapping topics.
          </p>
          <div className="mt-4 columns-1 gap-4 sm:columns-2">
            {related.map((a) => (
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
