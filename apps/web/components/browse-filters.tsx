import type { SortKey, SourceBrief, Topic } from '@/lib/api-types';

type Props = {
  sources: SourceBrief[];
  topics: Topic[];
  basePath?: string;
  /** Current search params from the page server component. */
  selected?: {
    q?: string;
    source?: string;
    topic?: string;
    min_minutes?: string;
    max_minutes?: string;
    from_date?: string;
    to_date?: string;
    sort?: string;
  };
};

const SORT_LABELS: Record<SortKey, string> = {
  newest: 'Newest',
  popular: 'Most saved',
  reading_time_asc: 'Shortest first',
};

/**
 * Server component — uncontrolled form, no JS dependency. Native browser submit.
 * Advanced filters live in a <details> element so the bar stays calm by default
 * but every filter is one click away. See DESIGN.md §2.2 — content leads.
 */
export function BrowseFilters({ sources, topics, basePath = '/browse', selected = {} }: Props) {
  const inputCls =
    'rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]';
  const labelCls =
    'text-[11px] font-medium uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]';

  // Count how many "advanced" filters are active. Drives the More filters summary.
  const advancedActive = [
    selected.source,
    selected.min_minutes,
    selected.max_minutes,
    selected.from_date,
    selected.to_date,
  ].filter(Boolean).length;

  const anyActive = !!(
    selected.q ||
    selected.topic ||
    advancedActive ||
    (selected.sort && selected.sort !== 'newest')
  );

  return (
    <form method="GET" action={basePath} className="mb-8">
      {/* Primary row: search + topic + sort + apply */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[240px] flex-1 flex-col gap-1.5">
          <span className={labelCls}>Search</span>
          <input
            type="search"
            name="q"
            defaultValue={selected.q ?? ''}
            placeholder="Climate, alpine, philosophy…"
            className={inputCls}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Topic</span>
          <select name="topic" defaultValue={selected.topic ?? ''} className={inputCls}>
            <option value="">All topics</option>
            {topics.map((t) => (
              <option key={t.id} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={labelCls}>Sort</span>
          <select name="sort" defaultValue={selected.sort ?? 'newest'} className={inputCls}>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABELS[k]}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] transition hover:opacity-90"
          >
            Apply
          </button>
          {anyActive && (
            <a
              href={basePath}
              className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:underline"
            >
              Clear
            </a>
          )}
        </div>
      </div>

      {/* Advanced: source + reading time + date range. <details> keeps this
          server-renderable and JS-free. */}
      <details
        className="mt-3 group"
        {...(advancedActive > 0 ? { open: true } : {})}
      >
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] [&::-webkit-details-marker]:hidden">
          <ChevronRightIcon />
          <span>More filters</span>
          {advancedActive > 0 && (
            <span className="ml-1 rounded-full bg-[hsl(var(--accent))]/15 px-2 py-0.5 text-xs font-medium text-[hsl(var(--accent))]">
              {advancedActive}
            </span>
          )}
        </summary>

        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Source</span>
            <select name="source" defaultValue={selected.source ?? ''} className={inputCls}>
              <option value="">All sources</option>
              {sources.map((s) => (
                <option key={s.id} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="flex flex-col gap-1.5">
            <legend className={labelCls}>Reading time (min)</legend>
            <div className="flex items-center gap-2">
              <input
                type="number"
                name="min_minutes"
                min={0}
                max={600}
                defaultValue={selected.min_minutes ?? ''}
                placeholder="0"
                aria-label="Minimum reading time"
                className={`${inputCls} w-20`}
              />
              <span className="text-sm text-[hsl(var(--muted-foreground))]">–</span>
              <input
                type="number"
                name="max_minutes"
                min={0}
                max={600}
                defaultValue={selected.max_minutes ?? ''}
                placeholder="∞"
                aria-label="Maximum reading time"
                className={`${inputCls} w-20`}
              />
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-1.5">
            <legend className={labelCls}>Published</legend>
            <div className="flex items-center gap-2">
              <input
                type="date"
                name="from_date"
                defaultValue={selected.from_date ?? ''}
                aria-label="From date"
                className={inputCls}
              />
              <span className="text-sm text-[hsl(var(--muted-foreground))]">–</span>
              <input
                type="date"
                name="to_date"
                defaultValue={selected.to_date ?? ''}
                aria-label="To date"
                className={inputCls}
              />
            </div>
          </fieldset>
        </div>
      </details>
    </form>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="transition group-open:rotate-90"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
