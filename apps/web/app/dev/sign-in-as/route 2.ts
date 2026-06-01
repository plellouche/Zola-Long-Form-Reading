// Dev-only: sign in as an arbitrary email by hitting Supabase's admin API
// to generate a magic-link token, then calling /auth/v1/verify ourselves
// server-side and forwarding the resulting session cookies back to the user.
//
// Works entirely server-side, so no client-side fragment parsing is needed.
// Refuses to run unless NODE_ENV is 'development'.
//
// Usage: GET /dev/sign-in-as?email=someone@example.com

import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'dev only' }, { status: 403 });
  }
  if (!SERVICE_ROLE) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 });
  }

  const { searchParams, origin } = new URL(request.url);
  const email = searchParams.get('email');
  if (!email) {
    return NextResponse.json(
      { error: 'pass ?email=someone@example.com' },
      { status: 400 },
    );
  }

  // 1) Generate an admin magic-link token (works for new + existing users).
  const genResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'magiclink', email }),
  });
  if (!genResp.ok) {
    const detail = await genResp.text();
    return NextResponse.json(
      { error: 'admin generate_link failed', detail },
      { status: genResp.status },
    );
  }
  const genJson = await genResp.json();
  // Supabase's response shape has shifted between versions — the older
  // SDK docs showed `properties.hashed_token`; the live Management API
  // currently returns it at the top level. Accept either.
  const hashed: string | undefined =
    genJson?.hashed_token ?? genJson?.properties?.hashed_token;
  if (!hashed) {
    return NextResponse.json(
      { error: 'no hashed_token in admin response', raw: genJson },
      { status: 500 },
    );
  }

  // 2) Verify the token server-side using the Supabase JS client, which
  //    writes the auth cookies into the response via our @supabase/ssr
  //    cookie adapter.
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: hashed,
  });
  if (error) {
    return NextResponse.json({ error: 'verifyOtp failed', message: error.message }, { status: 400 });
  }

  return NextResponse.redirect(`${origin}/`, { status: 303 });
}
