// Server-side helpers for the current viewer's personal-data API.
// Imported only from Server Components (it pulls in next/headers via
// `getUser`, which prevents Next from bundling it into client code).
//
// IMPORTANT: do NOT add a `"use server"` directive at the top of this file.
// That would turn every export into a Server Action and require all return
// types to be JSON-serializable across the RSC boundary — which breaks for
// any non-primitive container (a `Set`, in this file's earlier incarnation,
// silently broke the entire client bundle and killed hydration of
// SaveButton, AddToList, and CreateListForm).

import { ApiError } from '@longform/api-client';

import type { StatefulArticle } from './api-types';
import { getUser } from './auth';
import { getServerApiClient } from './server-api';

/**
 * Fetch the IDs of articles the current user has SAVED, as a plain array.
 *
 * Returns `[]` if the user isn't logged in or the API call fails.
 */
export async function getSavedArticleIds(): Promise<string[]> {
  const user = await getUser();
  if (!user) return [];
  try {
    const states = await getServerApiClient().request<StatefulArticle[]>(
      '/api/me/articles',
      { query: { status: 'SAVED', limit: '100' } },
    );
    return states.map((s) => s.article.id);
  } catch (err) {
    if (err instanceof ApiError) return [];
    throw err;
  }
}
