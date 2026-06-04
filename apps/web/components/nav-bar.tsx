import Link from 'next/link';

import { Avatar } from '@/components/avatar';
import { SearchInput } from '@/components/search-input';
import { ThemeToggle } from '@/components/theme-toggle';
import { getUser } from '@/lib/auth';
import { getServerApiClient } from '@/lib/server-api';
import { ApiError } from '@longform/api-client';

type ProfileMe = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
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

  const linkCls = 'rounded-md px-3 py-1.5 hover:bg-[hsl(var(--muted))]';
  const subtleLinkCls =
    'rounded-md px-3 py-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]';

  return (
    <header className="border-b border-[hsl(var(--border))]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 py-3 pl-2 pr-4 sm:py-4 sm:pl-3 sm:pr-6">
        <Link
          href="/"
          className="font-display text-[3rem] leading-none tracking-tight text-[hsl(var(--primary))]"
        >
          Zola
        </Link>

        <div className="hidden flex-1 pl-6 md:block">
          <SearchInput variant="nav" />
        </div>
        <div className="ml-auto md:hidden" />

        <nav className="flex items-center gap-1 text-sm">
          <Link href="/browse" className={linkCls}>
            Browse
          </Link>
          {user && isOnboarded && (
            <Link href="/discover" className={linkCls}>
              Discover
            </Link>
          )}
          {!user && (
            <>
              <Link href="/sources" className={`hidden sm:inline-flex ${linkCls}`}>
                Sources
              </Link>
              <Link href="/about" className={`hidden sm:inline-flex ${linkCls}`}>
                About
              </Link>
            </>
          )}

          {!user && (
            <Link
              href="/login"
              className="rounded-md bg-[hsl(var(--primary))] px-3 py-1.5 text-[hsl(var(--primary-foreground))]"
            >
              Sign in
            </Link>
          )}

          {user && isOnboarded && profile?.username && (
            <>
              {isAdmin && (
                <Link href="/admin/dashboard" className={`hidden sm:inline-flex ${subtleLinkCls}`}>
                  Admin
                </Link>
              )}
              <Link href="/leaderboard" className={`hidden sm:inline-flex ${linkCls}`}>
                Board
              </Link>
              <Link href="/lists" className={`hidden sm:inline-flex ${linkCls}`}>
                Lists
              </Link>
              <Link
                href={`/u/${profile.username}?tab=saved`}
                className={`hidden sm:inline-flex ${linkCls}`}
              >
                Saved
              </Link>
              <Link
                href={`/u/${profile.username}`}
                className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-[hsl(var(--muted))]"
                title={`@${profile.username}`}
              >
                <Avatar
                  src={profile.avatar_url}
                  name={profile.display_name ?? profile.username}
                  seed={profile.id}
                  size="sm"
                />
                <span className="hidden sm:inline">@{profile.username}</span>
              </Link>
              <Link href="/settings" className={`hidden sm:inline-flex ${linkCls}`}>
                Settings
              </Link>
              <form action="/auth/signout" method="post" className="hidden sm:block">
                <button type="submit" className={linkCls}>
                  Sign out
                </button>
              </form>
            </>
          )}

          {user && !isOnboarded && (
            <Link
              href="/onboarding"
              className="rounded-md bg-[hsl(var(--primary))] px-3 py-1.5 text-[hsl(var(--primary-foreground))]"
            >
              Finish setup
            </Link>
          )}

          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
