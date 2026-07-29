import { Platform } from 'react-native';
import { supabase } from './supabase';
import type {
  ArticleListResponse,
  ArticleSummary,
  ReadingList,
  ReadingListItem,
  Source,
  SwipeRequest,
  Topic,
  UserProfile,
  UserStats,
} from './types';

// On web (Replit preview) calls go through the Express proxy to avoid CORS.
// On native (Expo Go / production) calls go directly to the API.
const API_BASE =
  Platform.OS === 'web'
    ? '/api/zola'
    : 'https://api.zolalongform.com';

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` };
  }
  return {};
}

async function get<T>(path: string): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...headers },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status} ${path}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status} ${path}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ---------- Articles ----------
export const getArticles = (params?: {
  sort?: string;
  limit?: number;
  cursor?: string;
  source_slug?: string;
  topic_slug?: string;
}) => {
  const p = new URLSearchParams();
  if (params?.sort) p.set('sort', params.sort);
  if (params?.limit) p.set('limit', String(params.limit));
  if (params?.cursor) p.set('cursor', params.cursor);
  if (params?.source_slug) p.set('source_slug', params.source_slug);
  if (params?.topic_slug) p.set('topic_slug', params.topic_slug);
  const qs = p.toString();
  return get<ArticleListResponse>(`/api/articles${qs ? `?${qs}` : ''}`);
};

export const getArticle = (id: string) =>
  get<ArticleSummary>(`/api/articles/${id}`);

// ---------- Feed & Discover ----------
export const getFeed = (limit = 24) =>
  get<ArticleSummary[]>(`/api/feed?limit=${limit}`);

export const getDiscoverDeck = (limit = 25) =>
  get<ArticleSummary[]>(`/api/discover/deck?limit=${limit}`);

export const postSwipe = (body: SwipeRequest) =>
  post<unknown>('/api/discover/swipe', body);

// ---------- Search ----------
export const searchArticles = (q: string, limit = 20) =>
  get<ArticleSummary[]>(
    `/api/search?q=${encodeURIComponent(q)}&limit=${limit}`,
  );

// ---------- Lists ----------
export const getLists = () => get<ReadingList[]>('/api/lists');

export const getList = (id: string) =>
  get<{ list: ReadingList; items: ReadingListItem[] }>(`/api/lists/${id}`);

export const createList = (data: {
  name: string;
  description?: string;
  is_public?: boolean;
}) => post<ReadingList>('/api/lists', data);

export const addToList = (listId: string, articleId: string) =>
  post<unknown>(`/api/lists/${listId}/items`, { article_id: articleId });

// ---------- Topics & Sources ----------
export const getTopics = () => get<Topic[]>('/api/topics');

export const getSources = () => get<Source[]>('/api/sources');

export const getSourceBySlug = (slug: string) =>
  get<Source>(`/api/sources/${slug}`);

// ---------- Users ----------
export const getUser = (username: string) =>
  get<UserProfile>(`/api/users/${username}`);

export const getUserStats = (username: string) =>
  get<UserStats>(`/api/users/${username}/stats`);

// ---------- Events ----------
export const markArticleFinished = (articleId: string) =>
  post<unknown>('/api/events', {
    article_id: articleId,
    event_type: 'FINISH',
  });
