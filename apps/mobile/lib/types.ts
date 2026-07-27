export interface Source {
  id: string;
  name: string;
  slug: string;
  homepage_url: string;
  trust_score?: number;
  is_active?: boolean;
  last_ingested_at?: string;
}

export interface Topic {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface ArticleTopicLink {
  topic_id: string;
  weight: number;
  name?: string;
  slug?: string;
}

export interface UserArticleState {
  status: 'SAVED' | 'STARTED' | 'FINISHED' | 'INTERESTED' | 'DISMISSED';
  started_at?: string;
  finished_at?: string;
  rating?: number;
}

export interface ArticleSummary {
  id: string;
  title: string;
  author?: string;
  canonical_url: string;
  og_image_url?: string;
  description?: string;
  reading_time_minutes?: number;
  word_count?: number;
  quality_score?: number;
  save_count?: number;
  finish_count?: number;
  created_at: string;
  source?: Source;
  source_id?: string;
  source_name?: string;
  source_slug?: string;
  topics?: ArticleTopicLink[];
  user_state?: UserArticleState;
}

export interface ArticleListResponse {
  items: ArticleSummary[];
  next_cursor?: string | null;
}

export interface ReadingList {
  id: string;
  name: string;
  description?: string;
  is_public: boolean;
  item_count?: number;
  fork_count?: number;
  created_at: string;
  user_id?: string;
  owner?: UserProfile;
}

export interface ReadingListItem {
  id: string;
  article_id: string;
  list_id: string;
  added_at: string;
  article: ArticleSummary;
}

export interface UserProfile {
  id: string;
  username: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  created_at?: string;
  article_count?: number;
  followers_count?: number;
  following_count?: number;
  hours_read?: number;
  am_following?: boolean;
  is_self?: boolean;
}

export interface UserStats {
  finished_count: number;
  hours_read: number;
  sources_explored: number;
  avg_minutes: number;
  current_streak: number;
  top_source?: { slug: string; name: string; count: number };
}

export interface SwipeRequest {
  article_id: string;
  direction: 'left' | 'right' | 'up' | 'down';
}
