'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

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

/**
 * Plain HTML form (GET) — the browser handles navigation, the server renders
 * fresh with the new searchParams. No React event handlers in the hot path,
 * so it works whether or not hydration has completed.
 *
 * Inputs use conditional `name` attributes: when a field is empty (or sort
 * is the default), the attribute isn't rendered, so the browser omits it
 * from the submitted URL — keeping URLs clean.
 */
export function BrowseFilters({ sources, topics, basePath = '/browse' }: Props) {
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

  const selectCls =
    'rounded-md border border-[hsl(var(--border))] bg-transparent px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--foreground))]';
  const inputCls = selectCls;

  // Conditional name attribute: when undefined, the browser omits the field
  // from the submitted URL — keeps URLs clean when filters are unset.
  const nameWhenSet = (cond: boolean, name: string) => (cond ? name : undefined);

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
          name={nameWhenSet(!!q, 'q')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="climate, alpine, philosophy…"
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Topic</span>
        <select
          name={nameWhenSet(!!topic, 'topic')}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className={selectCls}
        >
          <option value="">All</option>
          {topics.map((t) => (
            <option key={t.id} value={t.slug}>{t.name}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Source</span>
        <select
          name={nameWhenSet(!!source, 'source')}
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className={selectCls}
        >
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
          name={nameWhenSet(!!minMin, 'min_minutes')}
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
          name={nameWhenSet(!!maxMin, 'max_minutes')}
          min={0}
          max={600}
          value={maxMin}
          onChange={(e) => setMaxMin(e.target.value)}
          className={`${inputCls} w-20`}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">From</span>
        <input
          type="date"
          name={nameWhenSet(!!fromDate, 'from_date')}
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">To</span>
        <input
          type="date"
          name={nameWhenSet(!!toDate, 'to_date')}
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Sort</span>
        <select
          name={nameWhenSet(sort !== 'newest', 'sort')}
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className={selectCls}
        >
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
