'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import type { SortKey, SourceBrief, Topic } from '@/lib/api-types';

type Props = {
  sources: SourceBrief[];
  topics: Topic[];
  basePath?: string; // default: /browse
};

const SORT_LABELS: Record<SortKey, string> = {
  newest: 'Newest',
  popular: 'Most saved',
  reading_time_asc: 'Shortest first',
};

export function BrowseFilters({ sources, topics, basePath = '/browse' }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get('q') ?? '');
  const [source, setSource] = useState(params.get('source') ?? '');
  const [topic, setTopic] = useState(params.get('topic') ?? '');
  const [minMin, setMinMin] = useState(params.get('min_minutes') ?? '');
  const [maxMin, setMaxMin] = useState(params.get('max_minutes') ?? '');
  const [fromDate, setFromDate] = useState(params.get('from_date') ?? '');
  const [toDate, setToDate] = useState(params.get('to_date') ?? '');
  const [sort, setSort] = useState<SortKey>((params.get('sort') as SortKey) || 'newest');

  // Re-sync local state if the URL changes externally (back/forward, Reset link, etc.)
  useEffect(() => {
    setQ(params.get('q') ?? '');
    setSource(params.get('source') ?? '');
    setTopic(params.get('topic') ?? '');
    setMinMin(params.get('min_minutes') ?? '');
    setMaxMin(params.get('max_minutes') ?? '');
    setFromDate(params.get('from_date') ?? '');
    setToDate(params.get('to_date') ?? '');
    setSort((params.get('sort') as SortKey) || 'newest');
  }, [params]);

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (source) p.set('source', source);
    if (topic) p.set('topic', topic);
    if (minMin) p.set('min_minutes', minMin);
    if (maxMin) p.set('max_minutes', maxMin);
    if (fromDate) p.set('from_date', fromDate);
    if (toDate) p.set('to_date', toDate);
    if (sort && sort !== 'newest') p.set('sort', sort);
    const qs = p.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
    // Next 15's Router Cache can serve a stale RSC payload when only
    // searchParams change. refresh() forces a fresh server render so the
    // filtered articles actually replace the unfiltered ones.
    router.refresh();
  }

  function reset() {
    setQ('');
    setSource('');
    setTopic('');
    setMinMin('');
    setMaxMin('');
    setFromDate('');
    setToDate('');
    setSort('newest');
    router.push(basePath);
    router.refresh();
  }

  const selectCls =
    'rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--foreground))]';
  const inputCls = selectCls;

  return (
    <form
      onSubmit={apply}
      className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-[hsl(var(--border))] p-3"
    >
      <label className="flex flex-1 min-w-[200px] flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Search</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="climate, alpine, philosophy…"
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Topic</span>
        <select value={topic} onChange={(e) => setTopic(e.target.value)} className={selectCls}>
          <option value="">All</option>
          {topics.map((t) => (
            <option key={t.id} value={t.slug}>{t.name}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Source</span>
        <select value={source} onChange={(e) => setSource(e.target.value)} className={selectCls}>
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
          min={0}
          max={600}
          value={minMin}
          onChange={(e) => setMinMin(e.target.value)}
          className={`${inputCls} w-20`}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Max min</span>
        <input
          type="number"
          min={0}
          max={600}
          value={maxMin}
          onChange={(e) => setMaxMin(e.target.value)}
          className={`${inputCls} w-20`}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">From</span>
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputCls} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">To</span>
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputCls} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Sort</span>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={selectCls}>
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
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm"
        >
          Reset
        </button>
      </div>
    </form>
  );
}
