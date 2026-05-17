import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getUser } from '@/lib/auth';
import { getServerApiClient } from '@/lib/server-api';
import { ApiError } from '@longform/api-client';

type ProfileMe = { username: string | null; onboarded_at: string | null };

export default async function HomePage() {
  const user = await getUser();

  if (user) {
    let profile: ProfileMe | null = null;
    try {
      profile = await getServerApiClient().request<ProfileMe>('/api/users/me');
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
    }
    if (profile && !profile.onboarded_at) {
      redirect('/onboarding');
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">
        Discover long-form essays worth your time.
      </h1>
      <p className="mt-4 text-lg text-[hsl(var(--muted-foreground))]">
        A high-signal library of essays, trip reports, and literary nonfiction. Save what you mean
        to read. Build lists. Follow people whose taste you trust.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/browse"
          className="rounded-md bg-[hsl(var(--foreground))] px-4 py-2 text-sm font-medium text-[hsl(var(--background))]"
        >
          Browse articles
        </Link>
        {!user && (
          <Link
            href="/login"
            className="rounded-md border border-[hsl(var(--border))] px-4 py-2 text-sm font-medium"
          >
            Sign in
          </Link>
        )}
      </div>
      <p className="mt-12 text-sm text-[hsl(var(--muted-foreground))]">
        Personalized recommendations land in Phase 7. For now, the library is curated by hand.
      </p>
    </main>
  );
}
