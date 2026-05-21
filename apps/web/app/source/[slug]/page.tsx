import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArticleCard } from '@/components/article-card';
import { FollowSourceButton } from '@/components/follow-source-button';
import { getUser } from '@/lib/auth';
import { getServerApiClient } from '@/lib/server-api';
import type { ArticleListResponse, SourceDetail } from '@/lib/api-types';
import { ApiError } from '@longform/api-client';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const src = await getServerApiClient().request<SourceDetail>(
      `/api/sources/${slug}`,
    );
    return {
      title: src.name,
      description: `Recent longform articles from ${src.name} on Longform.`,
      openGraph: { title: src.name, type: 'website' },
    };
  } catch {
    return { title: 'Source' };
  }
}

export default async function SourceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const api = getServerApiClient();

  let source: SourceDetail;
  try {
    source = await api.request<SourceDetail>(`/api/sources/${slug}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const [viewer, articles] = await Promise.all([
    getUser(),
    api.request<ArticleListResponse>('/api/articles', {
      query: { source_slug: slug, sort: 'newest', limit: '30' },
    }),
  ]);

  const host = (() => {
    try {
      return new URL(source.homepage_url).host;
    } catch {
      return source.homepage_url;
    }
  })();

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/browse" className="text-sm text-[hsl(var(--muted-foreground))]">
        ← Browse
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{source.name}</h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            <a
              href={source.homepage_url}
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
            >
              {host}
            </a>
          </p>
          <p className="mt-3 flex gap-3 text-sm text-[hsl(var(--muted-foreground))]">
            <span>
              <strong className="text-[hsl(var(--foreground))]">{source.article_count}</strong>{' '}
              {source.article_count === 1 ? 'article' : 'articles'}
            </span>
            <span>
              <strong className="text-[hsl(var(--foreground))]">{source.followers_count}</strong>{' '}
              {source.followers_count === 1 ? 'follower' : 'followers'}
            </span>
          </p>
        </div>
        {viewer && (
          <FollowSourceButton slug={source.slug} initiallyFollowing={source.am_following} />
        )}
      </header>

      <section className="mt-10">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          Recent articles
        </h2>
        {articles.items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[hsl(var(--border))] p-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
            No articles ingested yet from this source.
          </div>
        ) : (
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
            {articles.items.map((a) => (
              <ArticleCard key={a.id} article={a} showSave={!!viewer} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
