import Link from 'next/link';

import type { ProfileStats } from '@/lib/api-types';

type Props = {
  stats: ProfileStats;
};

function isEmpty(s: ProfileStats): boolean {
  // Hide the card entirely when the user has no reading yet — six "0"s look
  // accusatory on a brand-new profile.
  return s.finished_count === 0;
}

function Tile({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
}) {
  const inner = (
    <div className="rounded-lg border border-[hsl(var(--border))] p-4">
      <div className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
        {label}
      </div>
      <div className="mt-1 font-serif text-2xl font-medium leading-none">
        {value}
      </div>
      {hint && (
        <div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{hint}</div>
      )}
    </div>
  );
  return href ? (
    <Link href={href} className="block transition hover:border-[hsl(var(--foreground))]">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function ProfileStatsCard({ stats }: Props) {
  if (isEmpty(stats)) return null;

  const hours =
    stats.hours_read >= 10
      ? Math.round(stats.hours_read).toString()
      : stats.hours_read.toFixed(1);

  return (
    <section className="mt-8">
      <h2 className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        Reading
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Finished" value={stats.finished_count} />
        <Tile
          label="Hours read"
          value={hours}
          hint={stats.avg_minutes ? `~${stats.avg_minutes} min avg` : undefined}
        />
        <Tile
          label="Streak"
          value={stats.current_streak === 0 ? '—' : `${stats.current_streak}d`}
          hint={stats.current_streak === 0 ? 'No active streak' : 'days in a row'}
        />
        <Tile label="Sources" value={stats.sources_explored} hint="explored" />
        {stats.top_source ? (
          <Tile
            label="Top source"
            value={stats.top_source.name}
            hint={`${stats.top_source.count} finished`}
            href={`/source/${stats.top_source.slug}`}
          />
        ) : (
          <Tile label="Top source" value="—" hint="No finishes yet" />
        )}
        <Tile
          label="Avg length"
          value={stats.avg_minutes ? `${stats.avg_minutes}m` : '—'}
          hint="per article"
        />
      </div>
    </section>
  );
}
