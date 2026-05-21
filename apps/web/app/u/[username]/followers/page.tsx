import Link from 'next/link';
import { notFound } from 'next/navigation';

import { FollowList } from '@/components/follow-list';
import { getUser } from '@/lib/auth';
import { getServerApiClient } from '@/lib/server-api';
import type { PublicProfile } from '@/lib/api-types';
import { ApiError } from '@longform/api-client';

export default async function FollowersPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const api = getServerApiClient();

  let profile: PublicProfile;
  try {
    profile = await api.request<PublicProfile>(`/api/users/${username}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const [viewer, followers] = await Promise.all([
    getUser(),
    api.request<PublicProfile[]>(`/api/users/${username}/followers`, {
      query: { limit: '100' },
    }),
  ]);

  const heading = profile.display_name ?? `@${profile.username}`;
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href={`/u/${profile.username}`}
        className="text-sm text-[hsl(var(--muted-foreground))]"
      >
        ← {heading}
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Followers</h1>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
        {profile.followers_count}{' '}
        {profile.followers_count === 1 ? 'person follows' : 'people follow'}{' '}
        {profile.is_self ? 'you' : heading}.
      </p>
      <div className="mt-6">
        <FollowList
          profiles={followers}
          viewerSignedIn={!!viewer}
          emptyMessage={profile.is_self ? 'No followers yet.' : `${heading} has no followers yet.`}
        />
      </div>
    </main>
  );
}
