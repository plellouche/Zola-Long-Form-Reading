import { ArticleCard, type ArticleCardData } from '@/components/article-card';
import { getServerApiClient } from '@/lib/server-api';

type ArticleSummary = ArticleCardData & {
  canonical_url: string;
  content_policy: string;
  quality_score: number;
  created_at: string;
};

type Source = { id: string; slug: string; name: string; is_active: boolean };
type Topic = { id: string; slug: string; name: string };

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; topic?: string }>;
}) {
  const params = await searchParams;
  const api = getServerApiClient();

  const query: Record<string, string> = { limit: '60' };
  if (params.source) query.source_slug = params.source;
  if (params.topic) query.topic_slug = params.topic;

  const [articles, sources, topics] = await Promise.all([
    api.request<ArticleSummary[]>('/api/articles', { query }),
    api.request<Source[]>('/api/sources', { query: { active: 'true' } }),
    api.request<Topic[]>('/api/topics'),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Browse</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {articles.length} article{articles.length === 1 ? '' : 's'}
          {params.source && (
            <>
              {' '}
              · source: <strong>{params.source}</strong>
            </>
          )}
          {params.topic && (
            <>
              {' '}
              · topic: <strong>{params.topic}</strong>
            </>
          )}
        </p>
      </header>

      <FilterBar
        sources={sources}
        topics={topics}
        selectedSource={params.source ?? null}
        selectedTopic={params.topic ?? null}
      />

      {articles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[hsl(var(--border))] p-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
          No articles match these filters yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </div>
      )}
    </main>
  );
}

function FilterBar({
  sources,
  topics,
  selectedSource,
  selectedTopic,
}: {
  sources: Source[];
  topics: Topic[];
  selectedSource: string | null;
  selectedTopic: string | null;
}) {
  return (
    <form
      method="GET"
      action="/browse"
      className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-[hsl(var(--border))] p-3"
    >
      <label className="flex items-center gap-2 text-sm">
        <span className="text-[hsl(var(--muted-foreground))]">Source</span>
        <select
          name="source"
          defaultValue={selectedSource ?? ''}
          className="rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-1 text-sm"
        >
          <option value="">All</option>
          {sources.map((s) => (
            <option key={s.id} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <span className="text-[hsl(var(--muted-foreground))]">Topic</span>
        <select
          name="topic"
          defaultValue={selectedTopic ?? ''}
          className="rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-1 text-sm"
        >
          <option value="">All</option>
          {topics.map((t) => (
            <option key={t.id} value={t.slug}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="rounded-md bg-[hsl(var(--foreground))] px-3 py-1 text-sm text-[hsl(var(--background))]"
      >
        Apply
      </button>
      {(selectedSource || selectedTopic) && (
        <a href="/browse" className="text-sm text-[hsl(var(--muted-foreground))] underline">
          Clear
        </a>
      )}
    </form>
  );
}
