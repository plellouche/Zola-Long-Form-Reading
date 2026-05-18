import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArticleFeed } from '@/components/article-feed';
import { getServerApiClient } from '@/lib/server-api';
import type { ArticleListResponse, Topic } from '@/lib/api-types';
import { ApiError } from '@longform/api-client';

const PAGE_LIMIT = 24;

export default async function TopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const api = getServerApiClient();

  let topic: Topic;
  try {
    topic = await api.request<Topic>(`/api/topics/${slug}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const query: Record<string, string> = {
    limit: String(PAGE_LIMIT),
    topic_slug: slug,
  };
  if (sp.sort) query.sort = sp.sort;

  const feed = await api.request<ArticleListResponse>('/api/articles', { query });

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <Link href="/browse" className="text-sm text-[hsl(var(--muted-foreground))]">
        ← Browse
      </Link>
      <header className="mt-3 mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">{topic.name}</h1>
        {topic.description && (
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{topic.description}</p>
        )}
      </header>

      <ArticleFeed key={JSON.stringify(query)} initial={feed} query={query} />
    </main>
  );
}
