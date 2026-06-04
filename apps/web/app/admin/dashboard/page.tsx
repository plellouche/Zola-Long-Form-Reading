import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { getUser } from '@/lib/auth';
import { getServerApiClient } from '@/lib/server-api';
import { ApiError } from '@longform/api-client';

export const metadata: Metadata = {
  title: 'Dashboard',
  robots: { index: false, follow: false },
};

type DailyPoint = { date: string; count: number };
type TopArticle = {
  article_id: string;
  title: string;
  source_name: string;
  source_slug: string;
  count: number;
};
type TopSource = { slug: string; name: string; count: number };

type Dashboard = {
  totals: {
    users_onboarded: number;
    articles_active: number;
    ratings_given: number;
    articles_finished: number;
    saves: number;
  };
  growth: {
    signups_by_day: DailyPoint[];
    dau_by_day: DailyPoint[];
    finishes_by_day: DailyPoint[];
  };
  engagement: {
    active_30d: number;
    active_7d: number;
    active_1d: number;
    save_to_finish_rate: number;
    avg_finishes_per_user: number;
  };
  top_articles_finished: TopArticle[];
  top_sources_saved: TopSource[];
  top_sources_finished: TopSource[];
};

export default async function AdminDashboardPage() {
  const user = await getUser();
  if (!user) redirect('/login?next=/admin/dashboard');

  let data: Dashboard;
  try {
    data = await getServerApiClient().request<Dashboard>('/api/admin/dashboard');
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      // Non-admin lands here — treat as 404 to avoid confirming the route exists.
      notFound();
    }
    throw err;
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <h1 className="font-serif text-4xl font-medium tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Product metrics from the events table. Last 30 days. Refresh page for live data.
          </p>
        </div>
        <Link
          href="/settings/sources"
          className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          Sources →
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Tile label="Users" value={data.totals.users_onboarded} />
        <Tile
          label="Articles"
          value={data.totals.articles_active}
          hint={`${data.totals.ratings_given} ratings given`}
        />
        <Tile
          label="Finishes"
          value={data.totals.articles_finished}
          hint={`${data.totals.saves} saves`}
        />
        <Tile
          label="Save → finish"
          value={`${Math.round(data.engagement.save_to_finish_rate * 100)}%`}
          hint="conversion"
        />
        <Tile
          label="Active 7d"
          value={data.engagement.active_7d}
          hint={`${data.engagement.active_30d} in 30d`}
        />
      </section>

      <section className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard
          label="Signups · last 30d"
          series={data.growth.signups_by_day}
          color="hsl(var(--accent))"
        />
        <ChartCard
          label="DAU · last 30d"
          series={data.growth.dau_by_day}
          color="hsl(var(--primary))"
        />
        <ChartCard
          label="Finishes · last 30d"
          series={data.growth.finishes_by_day}
          color="hsl(var(--foreground))"
        />
      </section>

      <section className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <TopList
          label="Top articles by finishes"
          rows={data.top_articles_finished.map((a) => ({
            label: a.title,
            sub: a.source_name,
            href: `/article/${a.article_id}`,
            count: a.count,
          }))}
        />
        <TopList
          label="Top sources by saves"
          rows={data.top_sources_saved.map((s) => ({
            label: s.name,
            sub: `@${s.slug}`,
            href: `/source/${s.slug}`,
            count: s.count,
          }))}
        />
        <TopList
          label="Top sources by finishes"
          rows={data.top_sources_finished.map((s) => ({
            label: s.name,
            sub: `@${s.slug}`,
            href: `/source/${s.slug}`,
            count: s.count,
          }))}
        />
      </section>

      <p className="mt-12 text-xs text-[hsl(var(--muted-foreground))]">
        Page-time and navigation funnels aren&rsquo;t in this dashboard — they
        require new event types we don&rsquo;t log yet. See ROADMAP §
        &ldquo;PostHog (future expansion)&rdquo; for when to add a real
        analytics layer.
      </p>
    </main>
  );
}

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] p-4">
      <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
      </div>
      <div className="mt-1 font-serif text-2xl font-medium leading-none">{value}</div>
      {hint && (
        <div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{hint}</div>
      )}
    </div>
  );
}

function ChartCard({
  label,
  series,
  color,
}: {
  label: string;
  series: DailyPoint[];
  color: string;
}) {
  // Fill missing days with zero so the sparkline is continuous.
  const filled = densifyLast30(series);
  const max = Math.max(1, ...filled.map((p) => p.count));
  const total = filled.reduce((acc, p) => acc + p.count, 0);

  const width = 280;
  const height = 80;
  const stepX = width / (filled.length - 1 || 1);

  const points = filled
    .map((p, i) => {
      const x = i * stepX;
      const y = height - (p.count / max) * (height - 4) - 2;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] p-4">
      <div className="flex items-baseline justify-between">
        <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          {label}
        </div>
        <div className="font-serif text-2xl font-medium leading-none">{total}</div>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-3 h-20 w-full"
        preserveAspectRatio="none"
      >
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points}
        />
      </svg>
    </div>
  );
}

function TopList({
  label,
  rows,
}: {
  label: string;
  rows: { label: string; sub: string; href: string; count: number }[];
}) {
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] p-4">
      <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        {label}
      </div>
      <ol className="mt-3 space-y-2">
        {rows.length === 0 ? (
          <li className="text-sm text-[hsl(var(--muted-foreground))]">No data yet.</li>
        ) : (
          rows.map((r) => (
            <li key={r.href + r.label} className="flex items-center gap-2 text-sm">
              <span className="w-6 shrink-0 text-right font-serif text-[hsl(var(--muted-foreground))]">
                {r.count}
              </span>
              <Link
                href={r.href}
                className="min-w-0 flex-1 truncate hover:underline"
                title={r.label}
              >
                {r.label}
              </Link>
              <span className="shrink-0 text-xs text-[hsl(var(--muted-foreground))]">{r.sub}</span>
            </li>
          ))
        )}
      </ol>
    </div>
  );
}

/** Returns the input series filled with zeros for every day in the last 30 so the chart is continuous. */
function densifyLast30(series: DailyPoint[]): DailyPoint[] {
  const map = new Map(series.map((p) => [p.date, p.count]));
  const out: DailyPoint[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, count: map.get(key) ?? 0 });
  }
  return out;
}
