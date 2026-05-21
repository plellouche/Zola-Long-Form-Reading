import Link from 'next/link';

import { requireAdmin } from '@/lib/auth';
import { getServerApiClient } from '@/lib/server-api';

import { IngestButton } from './ingest-button';

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
  last_ingest_status: string | null;
  last_ingest_article_count: number;
  last_ingest_error: string | null;
  consecutive_failures: number;
  article_count: number;
};

function statusBadge(status: string | null, failures: number, isActive: boolean) {
  if (!isActive) {
    return <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] uppercase text-red-600">disabled</span>;
  }
  if (status === 'OK' || status === 'NO_CHANGES') {
    return <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] uppercase text-green-700">{status.toLowerCase().replace('_', ' ')}</span>;
  }
  if (status === 'ERROR' || status === 'BLOCKED') {
    return <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] uppercase text-amber-700">{status.toLowerCase()} {failures > 1 ? `×${failures}` : ''}</span>;
  }
  if (status === 'NO_RSS') {
    return <span className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] uppercase text-[hsl(var(--muted-foreground))]">no rss</span>;
  }
  return <span className="rounded bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] uppercase text-[hsl(var(--muted-foreground))]">never</span>;
}

function relTime(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default async function AdminSourcesPage() {
  await requireAdmin();
  const sources = await getServerApiClient().request<Source[]>('/api/sources');
  const totalArticles = sources.reduce((acc, s) => acc + s.article_count, 0);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sources</h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            {sources.length} sources · {totalArticles} articles total
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/settings/invites"
            className="rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm hover:border-[hsl(var(--foreground))]"
          >
            Invites
          </Link>
          <Link
            href="/settings/articles/new"
            className="rounded-md bg-[hsl(var(--foreground))] px-3 py-1.5 text-sm text-[hsl(var(--background))]"
          >
            + New article
          </Link>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
        <table className="w-full text-sm">
          <thead className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Kind</th>
              <th className="px-3 py-2 font-medium">Trust</th>
              <th className="px-3 py-2 font-medium text-right">Articles</th>
              <th className="px-3 py-2 font-medium">Last ingest</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id} className="border-b border-[hsl(var(--border))] last:border-0 align-top">
                <td className="px-3 py-2">
                  <div className="font-medium">{s.name}</div>
                  <div className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">{s.slug}</div>
                </td>
                <td className="px-3 py-2 text-xs">{s.kind}</td>
                <td className="px-3 py-2">{s.trust_score.toFixed(2)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{s.article_count}</td>
                <td className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">{relTime(s.last_ingested_at)}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-1">
                    {statusBadge(s.last_ingest_status, s.consecutive_failures, s.is_active)}
                    {s.last_ingest_error && (
                      <span className="line-clamp-1 text-[10px] text-red-600" title={s.last_ingest_error}>
                        {s.last_ingest_error}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {s.rss_url ? <IngestButton sourceId={s.id} /> : <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
