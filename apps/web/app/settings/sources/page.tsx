import Link from 'next/link';

import { requireAdmin } from '@/lib/auth';
import { getServerApiClient } from '@/lib/server-api';

type Source = {
  id: string;
  name: string;
  slug: string;
  homepage_url: string;
  rss_url: string | null;
  content_policy: string;
  kind: string;
  trust_score: number;
  is_active: boolean;
  last_ingested_at: string | null;
};

export default async function AdminSourcesPage() {
  await requireAdmin();
  const sources = await getServerApiClient().request<Source[]>('/api/sources');

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Sources</h1>
        <Link
          href="/settings/articles/new"
          className="rounded-md bg-[hsl(var(--foreground))] px-3 py-1.5 text-sm text-[hsl(var(--background))]"
        >
          + New article
        </Link>
      </div>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
        {sources.length} sources seeded. Editing lands in a later phase; for now, manage via SQL.
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
        <table className="w-full text-sm">
          <thead className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Slug</th>
              <th className="px-3 py-2 font-medium">Kind</th>
              <th className="px-3 py-2 font-medium">Policy</th>
              <th className="px-3 py-2 font-medium">Trust</th>
              <th className="px-3 py-2 font-medium">Active</th>
              <th className="px-3 py-2 font-medium">RSS</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id} className="border-b border-[hsl(var(--border))] last:border-0">
                <td className="px-3 py-2">{s.name}</td>
                <td className="px-3 py-2 font-mono text-xs text-[hsl(var(--muted-foreground))]">
                  {s.slug}
                </td>
                <td className="px-3 py-2 text-xs">{s.kind}</td>
                <td className="px-3 py-2 text-xs">{s.content_policy}</td>
                <td className="px-3 py-2">{s.trust_score.toFixed(2)}</td>
                <td className="px-3 py-2">{s.is_active ? '✓' : '—'}</td>
                <td className="px-3 py-2 text-xs">{s.rss_url ? '✓' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
