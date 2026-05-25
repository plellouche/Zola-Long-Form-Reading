// Shared client-side types mirroring the FastAPI response shapes.
// Keep in sync with services/api/app/schemas/* and routers/*.

export type SortKey = 'mixed' | 'newest' | 'popular' | 'reading_time_asc';

export type ArticleAccessTier = 'free' | 'metered' | 'locked' | 'unknown';

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
  access_tier: ArticleAccessTier;
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
  followers_count: number;
  following_count: number;
  am_following: boolean;
  is_self: boolean;
};

export type ProfileStats = {
  finished_count: number;
  hours_read: number;
  sources_explored: number;
  avg_minutes: number | null;
  current_streak: number;
  top_source: { slug: string; name: string; count: number } | null;
};

export type LeaderboardEntry = {
  profile: PublicProfile;
  hours_read: number;
  finished_count: number;
  rank: number;
};

export type LeaderboardPeriod = 'week' | 'month' | 'all_time';

export type ActivityItem = {
  event_id: string;
  event_type: string;
  created_at: string;
  actor: PublicProfile;
  article: ArticleSummary;
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

export type SourceDetail = {
  id: string;
  name: string;
  slug: string;
  homepage_url: string;
  rss_url: string | null;
  content_policy: 'REDIRECT_ONLY' | 'EMBED_ALLOWED' | 'FULLTEXT_ALLOWED';
  kind: string;
  trust_score: number;
  is_active: boolean;
  article_count: number;
  followers_count: number;
  am_following: boolean;
  created_at: string;
};

export type UserArticleStatus = 'SAVED' | 'READING' | 'FINISHED' | 'DISMISSED' | 'INTERESTED';

export type ArticleRating = 'LOVED' | 'LIKED' | 'OK';

export type UserArticleState = {
  article_id: string;
  status: UserArticleStatus;
  opened_at: string | null;
  finished_at: string | null;
  time_spent_seconds: number;
  rating: ArticleRating | null;
  updated_at: string;
};

export type StatefulArticle = {
  article: ArticleSummary;
  state: UserArticleState;
};

export type ReadingList = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  forked_from_id: string | null;
  created_at: string;
  updated_at: string;
  item_count: number;
};

export type ListItem = {
  article: ArticleSummary;
  position: number;
  added_at: string;
};

export type ReadingListDetail = ReadingList & {
  items: ListItem[];
};

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
