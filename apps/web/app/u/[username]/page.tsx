import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getServerApiClient } from '@/lib/server-api';
import { ApiError } from '@longform/api-client';

type PublicProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  let profile: PublicProfile;
  try {
    profile = await getServerApiClient().request<PublicProfile>(`/api/users/${username}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/" className="text-sm text-[hsl(var(--muted-foreground))]">
        ← Home
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        {profile.display_name ?? `@${profile.username}`}
      </h1>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">@{profile.username}</p>
      {profile.bio && <p className="mt-6 whitespace-pre-wrap">{profile.bio}</p>}
      <p className="mt-8 text-sm text-[hsl(var(--muted-foreground))]">
        Lists and follow features land in Phase 5+.
      </p>
    </main>
  );
}
