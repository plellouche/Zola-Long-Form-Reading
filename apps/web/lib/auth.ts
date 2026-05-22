import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

import { createSupabaseServerClient } from './supabase/server';
import { getServerApiClient } from './server-api';
import { ApiError } from '@longform/api-client';

/** Returns the current user, or null if not logged in. Safe in Server Components. */
export async function getUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/** Redirects to /login if not signed in OR if no access token is available
 *  (a degraded session where Supabase has a user but the local cookie no
 *  longer carries a usable JWT — bouncing forces a fresh sign-in). */
export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect('/login');
  const token = await getAccessToken();
  if (!token) redirect('/login');
  return user;
}

/** Returns the current access token (server-side), or null. For calling FastAPI. */
export async function getAccessToken(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export type ProfileMe = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: 'user' | 'admin';
  onboarded_at: string | null;
};

/** Loads the FastAPI-side profile for the current user, or null. */
export async function getProfile(): Promise<ProfileMe | null> {
  const user = await getUser();
  if (!user) return null;
  try {
    return await getServerApiClient().request<ProfileMe>('/api/users/me');
  } catch (err) {
    if (err instanceof ApiError) return null;
    throw err;
  }
}

/** Redirects non-admins to /. */
export async function requireAdmin(): Promise<ProfileMe> {
  const profile = await getProfile();
  if (!profile || profile.role !== 'admin') redirect('/');
  return profile;
}
