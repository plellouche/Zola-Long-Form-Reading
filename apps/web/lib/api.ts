import { ApiClient } from '@longform/api-client';
import { createSupabaseBrowserClient } from './supabase/client';

let cachedClient: ApiClient | null = null;

export function getBrowserApiClient(): ApiClient {
  if (cachedClient) return cachedClient;
  const supabase = createSupabaseBrowserClient();
  cachedClient = new ApiClient({
    baseUrl: process.env.NEXT_PUBLIC_API_URL!,
    getAuthToken: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    },
  });
  return cachedClient;
}
