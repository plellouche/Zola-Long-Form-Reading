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
 * Server component — plain HTML form, no React state, no JS dependency.
 * Inputs are uncontrolled with defaultValue read from the current URL
 * params (passed in by the page). The browser submits the form natively;
 * empty fields are tolerated by the page's buildQuery (which falsy-filters).
 *
 * Why uncontrolled: a controlled <input value=...> with a conditional `name`
 * attribute (the previous attempt) only got the `name` rendered AFTER React
 * re-rendered post-onChange. If hydration was incomplete or React batched the
 * update, the submit handler ran before the attribute was applied — the form
 * submitted with NO fields, ending up at /browse? with empty params.
 */
export function BrowseFilters({ sources, topics, basePath = '/browse', selected = {} }: Props) {
  const selectCls =
    'rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--foreground))]';
  const inputCls = selectCls;

  return (
    <form
      method="GET"
      action={basePath}
      className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-[hsl(var(--border))] p-3"
    >
      <label className="flex flex-1 min-w-[200px] flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Search</span>
        <input
          type="search"
          name="q"
          defaultValue={selected.q ?? ''}
          placeholder="climate, alpine, philosophy…"
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Topic</span>
        <select name="topic" defaultValue={selected.topic ?? ''} className={selectCls}>
          <option value="">All</option>
          {topics.map((t) => (
            <option key={t.id} value={t.slug}>{t.name}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Source</span>
        <select name="source" defaultValue={selected.source ?? ''} className={selectCls}>
          <option value="">All</option>
          {sources.map((s) => (
            <option key={s.id} value={s.slug}>{s.name}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Min min</span>
        <input
          type="number"
          name="min_minutes"
          min={0}
          max={600}
          defaultValue={selected.min_minutes ?? ''}
          className={`${inputCls} w-20`}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Max min</span>
        <input
          type="number"
          name="max_minutes"
          min={0}
          max={600}
          defaultValue={selected.max_minutes ?? ''}
          className={`${inputCls} w-20`}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">From</span>
        <input
          type="date"
          name="from_date"
          defaultValue={selected.from_date ?? ''}
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">To</span>
        <input
          type="date"
          name="to_date"
          defaultValue={selected.to_date ?? ''}
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Sort</span>
        <select name="sort" defaultValue={selected.sort ?? 'newest'} className={selectCls}>
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <option key={k} value={k}>{SORT_LABELS[k]}</option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-md bg-[hsl(var(--foreground))] px-3 py-1.5 text-sm text-[hsl(var(--background))]"
        >
          Apply
        </button>
        <a
          href={basePath}
          className="rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm"
        >
          Reset
        </a>
      </div>
    </form>
  );
}
