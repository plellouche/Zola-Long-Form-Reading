'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Catches Supabase implicit-flow tokens that arrive in the URL fragment.
 *
 * The `/auth/callback` route handles the PKCE / code-query flow used by
 * the regular email OTP login. But admin-generated `/auth/v1/verify` links
 * (and a few other Supabase paths) use the implicit flow: the access token
 * comes back as `#access_token=…&refresh_token=…&type=…`.
 *
 * `@supabase/ssr`'s `createBrowserClient` defaults to PKCE flow and does not
 * auto-process implicit-flow fragments. So we have to parse the fragment
 * ourselves and call `setSession` with the tokens, which then triggers the
 * cookie writes via the SSR cookie adapter we configured in
 * `lib/supabase/client.ts`.
 *
 * This component is mounted from the root layout, runs on every client
 * render, no-ops unless an auth fragment is present.
 */
export function AuthFragmentHandler() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (!hash || hash.length < 2) return;

    const params = new URLSearchParams(hash.slice(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const errorCode = params.get('error') || params.get('error_code');

    if (!accessToken && !errorCode) return;

    let cancelled = false;
    (async () => {
      if (errorCode) {
        // Clean the fragment so the URL doesn't keep showing the error.
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        return;
      }
      if (!accessToken || !refreshToken) return;

      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (cancelled) return;
      // Always clean the fragment, success or failure.
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      if (!error) {
        // Re-fetch RSC payload so NavBar + page state reflect the new session.
        router.refresh();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
