import type { ContentPolicy } from './source';

export interface Article {
  id: string;
  sourceId: string;
  title: string;
  author: string | null;
  publicationDate: string | null;
  canonicalUrl: string;
  ogImageUrl: string | null;
  description: string | null;
  readingTimeMinutes: number | null;
  wordCount: number | null;
  contentPolicy: ContentPolicy;
  fullText: string | null;
  qualityScore: number;
  saveCount: number;
  finishCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleTopic {
  articleId: string;
  topicId: string;
  weight: number;
}

export type UserArticleStatus = 'SAVED' | 'READING' | 'FINISHED' | 'DISMISSED';

export interface UserArticleState {
  id: string;
  userId: string;
  articleId: string;
  status: UserArticleStatus;
  openedAt: string | null;
  finishedAt: string | null;
  timeSpentSeconds: number;
  updatedAt: string;
}
