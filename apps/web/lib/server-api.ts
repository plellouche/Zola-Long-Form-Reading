import { ApiClient } from '@longform/api-client';

import { getAccessToken } from './auth';

/**
 * Returns an ApiClient configured to call FastAPI from a Server Component or
 * Route Handler, with the current user's Supabase JWT attached automatically.
 */
export function getServerApiClient(): ApiClient {
  return new ApiClient({
    baseUrl: process.env.NEXT_PUBLIC_API_URL!,
    getAuthToken: () => getAccessToken(),
  });
}
