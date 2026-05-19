'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Catches Supabase implicit-flow tokens that arrive in the URL fragment.
 *
 * The `/auth/callback` route handles the PKCE / code-query flow used by
 * email-based magic links. But admin-generated `/auth/v1/verify` links (and
 * a few other paths) use Supabase's implicit flow: the access token comes
 * back as `#access_token=…&refresh_token=…&type=…`. URL fragments aren't
 * sent to the server, so server components can't see the token and the user
 * looks logged-out even though the URL contains valid credentials.
 *
 * This component runs on every client render (mounted from the root layout)
 * and, if it detects a fragment, lets the Supabase browser client consume it
 * (which writes the session cookies via @supabase/ssr) then refreshes the
 * server tree so the NavBar reflects the new session.
 */
export function AuthFragmentHandler() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (!hash || (!hash.includes('access_token') && !hash.includes('error'))) return;

    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      // Instantiating the browser client triggers @supabase/ssr's
      // detectSessionInUrl handling. Wait briefly, then confirm a session
      // exists before refreshing.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      // Clean the fragment so a future refresh doesn't reprocess it.
      const cleaned = window.location.pathname + window.location.search;
      window.history.replaceState(null, '', cleaned);
      if (data.session) {
        router.refresh();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
