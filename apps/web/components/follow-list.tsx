import Link from 'next/link';

import { Avatar } from '@/components/avatar';
import { FollowButton } from '@/components/follow-button';
import type { PublicProfile } from '@/lib/api-types';

type Props = {
  profiles: PublicProfile[];
  viewerSignedIn: boolean;
  emptyMessage: string;
};

export function FollowList({ profiles, viewerSignedIn, emptyMessage }: Props) {
  if (profiles.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[hsl(var(--border))] p-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[hsl(var(--border))]">
      {profiles.map((p) => (
        <li key={p.id} className="flex items-center gap-3 py-3">
          <Link href={`/u/${p.username}`} className="shrink-0">
            <Avatar
              src={p.avatar_url}
              name={p.display_name ?? p.username}
              seed={p.id}
              size="md"
            />
          </Link>
          <div className="min-w-0 flex-1">
            <Link
              href={`/u/${p.username}`}
              className="block truncate font-medium hover:underline"
            >
              {p.display_name ?? `@${p.username}`}
            </Link>
            <Link
              href={`/u/${p.username}`}
              className="block truncate text-sm text-[hsl(var(--muted-foreground))]"
            >
              @{p.username}
            </Link>
            {p.bio && (
              <p className="mt-0.5 line-clamp-1 text-sm text-[hsl(var(--muted-foreground))]">
                {p.bio}
              </p>
            )}
          </div>
          {viewerSignedIn && !p.is_self && (
            <FollowButton username={p.username} initiallyFollowing={p.am_following} />
          )}
        </li>
      ))}
    </ul>
  );
}
