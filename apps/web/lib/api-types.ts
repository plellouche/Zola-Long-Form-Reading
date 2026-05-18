// Shared client-side types mirroring the FastAPI response shapes.
// Keep in sync with services/api/app/schemas/* and routers/*.

export type SortKey = 'newest' | 'popular' | 'reading_time_asc';

export type ArticleSummary = {
  id: string;
  source: { id: string; slug: string; name: string };
  title: string;
  author: string | null;
  publication_date: string | null;
  canonical_url: string;
  og_image_url: string | null;
  description: string | null;
  reading_time_minutes: number | null;
  content_policy: 'REDIRECT_ONLY' | 'EMBED_ALLOWED' | 'FULLTEXT_ALLOWED';
  quality_score: number;
  created_at: string;
};

export type ArticleListResponse = {
  items: ArticleSummary[];
  next_cursor: string | null;
};

export type PublicProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

export type SearchResponse = {
  articles: ArticleSummary[];
  users: PublicProfile[];
};

export type Topic = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

export type SourceBrief = { id: string; slug: string; name: string; is_active: boolean };

export type BrowseFilters = {
  q?: string;
  source?: string;
  topic?: string;
  min_minutes?: string;
  max_minutes?: string;
  from_date?: string;
  to_date?: string;
  sort?: SortKey;
};

export function toQuery(filters: BrowseFilters, extra?: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  if (filters.q) out.q = filters.q;
  if (filters.source) out.source_slug = filters.source;
  if (filters.topic) out.topic_slug = filters.topic;
  if (filters.min_minutes) out.min_reading_time = filters.min_minutes;
  if (filters.max_minutes) out.max_reading_time = filters.max_minutes;
  if (filters.from_date) out.from_date = filters.from_date;
  if (filters.to_date) out.to_date = filters.to_date;
  if (filters.sort && filters.sort !== 'newest') out.sort = filters.sort;
  if (extra) Object.assign(out, extra);
  return out;
}
