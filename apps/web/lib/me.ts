"use server";

import { getUser } from './auth';
import { getServerApiClient } from './server-api';
import { ApiError } from '@longform/api-client';
import type { StatefulArticle } from './api-types';

/**
 * Fetch the IDs of articles the current user has SAVED. Used by feed pages
 * to seed each card's SaveButton initial state without an N+1 lookup.
 *
 * Returns an empty Set if the user isn't logged in or the API fails.
 */
export async function getSavedArticleIds(): Promise<Set<string>> {
  const user = await getUser();
  if (!user) return new Set();
  try {
    const states = await getServerApiClient().request<StatefulArticle[]>(
      '/api/me/articles',
      { query: { status: 'SAVED', limit: '100' } },
    );
    return new Set(states.map((s) => s.article.id));
  } catch (err) {
    if (err instanceof ApiError) return new Set();
    throw err;
  }
}
