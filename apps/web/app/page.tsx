import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getUser } from '@/lib/auth';
import { getServerApiClient } from '@/lib/server-api';
import { ApiError } from '@longform/api-client';

type ProfileMe = {
  id: string;
  username: string | null;
  display_name: string | null;
  onboarded_at: string | null;
};

export default async function HomePage() {
  const user = await getUser();

  if (user) {
    let profile: ProfileMe | null = null;
    try {
      profile = await getServerApiClient().request<ProfileMe>('/api/users/me');
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      // Surfaced below as a soft state — profile row may not exist yet if the trigger failed.
    }
    if (profile && !profile.onboarded_at) {
      redirect('/onboarding');
    }
    return <LoggedInHome email={user.email ?? ''} username={profile?.username ?? null} />;
  }

  return <AnonHome />;
}

function AnonHome() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="text-4xl font-semibold tracking-tight">Longform</h1>
      <p className="mt-4 text-lg text-[hsl(var(--muted-foreground))]">
        Pinterest-for-long-form-reading. Discover, save, and share high-signal essays.
      </p>
      <div className="mt-8">
        <Link
          href="/login"
          className="inline-block rounded-md bg-[hsl(var(--foreground))] px-4 py-2 text-sm font-medium text-[hsl(var(--background))]"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}

function LoggedInHome({ email, username }: { email: string; username: string | null }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="text-4xl font-semibold tracking-tight">Longform</h1>
      <p className="mt-4 text-lg text-[hsl(var(--muted-foreground))]">
        Signed in as <strong>{email}</strong>
        {username && <> (@{username})</>}.
      </p>
      <nav className="mt-8 flex flex-wrap gap-3 text-sm">
        {username && (
          <Link
            href={`/u/${username}`}
            className="rounded-md border border-[hsl(var(--border))] px-3 py-2"
          >
            My profile
          </Link>
        )}
        <Link
          href="/settings"
          className="rounded-md border border-[hsl(var(--border))] px-3 py-2"
        >
          Settings
        </Link>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-md border border-[hsl(var(--border))] px-3 py-2"
          >
            Sign out
          </button>
        </form>
      </nav>
      <p className="mt-8 text-sm text-[hsl(var(--muted-foreground))]">
        Phase 1 complete. Browse, lists, and recommendations land in later phases.
      </p>
    </main>
  );
}
