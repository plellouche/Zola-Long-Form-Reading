import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { getUser } from '@/lib/auth';
import { getServerApiClient } from '@/lib/server-api';
import { ApiError } from '@longform/api-client';

import { UserDirectoryClient } from './user-directory-client';

export const metadata: Metadata = {
  title: 'Users',
  robots: { index: false, follow: false },
};

export type UserRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
  role: string;
  created_at: string;
  onboarded_at: string | null;
  last_active_at: string | null;
  finished_count: number;
  saved_count: number;
};

export type UsersResponse = {
  items: UserRow[];
  total: number;
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; days?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect('/login?next=/admin/users');

  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const days = sp.days && /^\d+$/.test(sp.days) ? Math.min(365, Math.max(1, parseInt(sp.days, 10))) : undefined;

  const query: Record<string, string> = { limit: '200' };
  if (q) query.q = q;
  if (days) query.days = String(days);

  let data: UsersResponse;
  try {
    data = await getServerApiClient().request<UsersResponse>('/api/admin/users', { query });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      notFound();
    }
    throw err;
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl font-medium tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            {data.total} {data.total === 1 ? 'user' : 'users'}
            {q ? ` matching “${q}”` : ''}
            {days ? ` from the last ${days} days` : ''}
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link
            href="/admin/dashboard"
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <UserDirectoryClient initial={data.items} initialQ={q ?? ''} initialDays={days ?? null} />
    </main>
  );
}
