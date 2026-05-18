import Link from 'next/link';

import { SearchInput } from '@/components/search-input';
import { getUser } from '@/lib/auth';
import { getServerApiClient } from '@/lib/server-api';
import { ApiError } from '@longform/api-client';

type ProfileMe = {
  username: string | null;
  role: string;
  onboarded_at: string | null;
};

export async function NavBar() {
  const user = await getUser();

  let profile: ProfileMe | null = null;
  if (user) {
    try {
      profile = await getServerApiClient().request<ProfileMe>('/api/users/me');
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
    }
  }

  const isAdmin = profile?.role === 'admin';
  const isOnboarded = !!profile?.onboarded_at;

  return (
    <header className="border-b border-[hsl(var(--border))]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="text-base font-semibold tracking-tight">
          Longform
        </Link>
        <SearchInput variant="nav" />
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/browse"
            className="rounded-md px-3 py-1.5 hover:bg-[hsl(var(--muted))]"
          >
            Browse
          </Link>
          {!user && (
            <Link
              href="/login"
              className="rounded-md bg-[hsl(var(--foreground))] px-3 py-1.5 text-[hsl(var(--background))]"
            >
              Sign in
            </Link>
          )}
          {user && isOnboarded && profile?.username && (
            <>
              {isAdmin && (
                <Link
                  href="/settings/sources"
                  className="rounded-md px-3 py-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
                >
                  Admin
                </Link>
              )}
              <Link
                href="/lists"
                className="rounded-md px-3 py-1.5 hover:bg-[hsl(var(--muted))]"
              >
                Lists
              </Link>
              <Link
                href={`/u/${profile.username}?tab=saved`}
                className="rounded-md px-3 py-1.5 hover:bg-[hsl(var(--muted))]"
              >
                Saved
              </Link>
              <Link
                href={`/u/${profile.username}`}
                className="rounded-md px-3 py-1.5 hover:bg-[hsl(var(--muted))]"
              >
                @{profile.username}
              </Link>
              <Link
                href="/settings"
                className="rounded-md px-3 py-1.5 hover:bg-[hsl(var(--muted))]"
              >
                Settings
              </Link>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="rounded-md px-3 py-1.5 hover:bg-[hsl(var(--muted))]"
                >
                  Sign out
                </button>
              </form>
            </>
          )}
          {user && !isOnboarded && (
            <Link
              href="/onboarding"
              className="rounded-md bg-[hsl(var(--foreground))] px-3 py-1.5 text-[hsl(var(--background))]"
            >
              Finish setup
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
