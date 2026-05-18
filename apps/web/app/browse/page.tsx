import { ArticleFeed } from '@/components/article-feed';
import { BrowseFilters } from '@/components/browse-filters';
import { getUser } from '@/lib/auth';
import { getSavedArticleIds } from '@/lib/me';
import { getServerApiClient } from '@/lib/server-api';
import type { ArticleListResponse, SourceBrief, Topic } from '@/lib/api-types';

const PAGE_LIMIT = 24;

type SearchParams = {
  q?: string;
  source?: string;
  topic?: string;
  min_minutes?: string;
  max_minutes?: string;
  from_date?: string;
  to_date?: string;
  sort?: string;
};

function buildQuery(p: SearchParams): Record<string, string> {
  const out: Record<string, string> = { limit: String(PAGE_LIMIT) };
  if (p.q) out.q = p.q;
  if (p.source) out.source_slug = p.source;
  if (p.topic) out.topic_slug = p.topic;
  if (p.min_minutes) out.min_reading_time = p.min_minutes;
  if (p.max_minutes) out.max_reading_time = p.max_minutes;
  if (p.from_date) out.from_date = p.from_date;
  if (p.to_date) out.to_date = p.to_date;
  if (p.sort) out.sort = p.sort;
  return out;
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const api = getServerApiClient();
  const query = buildQuery(params);

  const user = await getUser();
  const [feed, sources, topics, savedIds] = await Promise.all([
    api.request<ArticleListResponse>('/api/articles', { query }),
    api.request<SourceBrief[]>('/api/sources', { query: { active: 'true' } }),
    api.request<Topic[]>('/api/topics'),
    user ? getSavedArticleIds() : Promise.resolve(new Set<string>()),
  ]);

  const activeFilters = [
    params.q && `“${params.q}”`,
    params.topic && `topic: ${params.topic}`,
    params.source && `source: ${params.source}`,
    params.min_minutes && `≥${params.min_minutes} min`,
    params.max_minutes && `≤${params.max_minutes} min`,
    params.from_date && `from ${params.from_date}`,
    params.to_date && `to ${params.to_date}`,
    params.sort && params.sort !== 'newest' && `sort: ${params.sort}`,
  ].filter(Boolean);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Browse</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {activeFilters.length > 0 ? activeFilters.join(' · ') : 'All articles'}
        </p>
      </header>

      <BrowseFilters sources={sources} topics={topics} selected={params} />

      {/* key forces a fresh mount of the feed when filters change so its
          internal state (items, cursor) gets reseeded from the new server fetch. */}
      <ArticleFeed
        key={JSON.stringify(query)}
        initial={feed}
        query={query}
        showSave={!!user}
        savedIds={Array.from(savedIds)}
      />
    </main>
  );
}
