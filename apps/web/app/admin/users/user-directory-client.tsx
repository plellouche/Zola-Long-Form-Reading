'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import type { UserRow } from './page';

type Props = {
  initial: UserRow[];
  initialQ: string;
  initialDays: number | null;
};

export function UserDirectoryClient({ initial, initialQ, initialDays }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(initialQ);
  const [days, setDays] = useState<number | null>(initialDays);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Debounce search/filter updates into the URL — page is server-rendered,
  // so a URL change re-fetches with the new filters.
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (q.trim()) next.set('q', q.trim());
      else next.delete('q');
      if (days) next.set('days', String(days));
      else next.delete('days');
      const url = `/admin/users${next.toString() ? `?${next}` : ''}`;
      router.replace(url);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, days]);

  const rows = initial;

  const fmt = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    [],
  );

  async function copyEmail(row: UserRow) {
    if (!row.email) return;
    try {
      await navigator.clipboard.writeText(row.email);
      setCopiedId(row.id);
      setTimeout(() => setCopiedId((c) => (c === row.id ? null : c)), 1500);
    } catch {
      // ignore — focus/secure-context may have blocked clipboard
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search username, display name, or email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[260px] flex-1 rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
        />
        <select
          value={days ?? ''}
          onChange={(e) => setDays(e.target.value ? parseInt(e.target.value, 10) : null)}
          className="rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm"
        >
          <option value="">All time</option>
          <option value="1">Last 1 day</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
        <table className="w-full text-sm">
          <thead className="bg-[hsl(var(--muted))] text-left text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 text-right font-medium">Saved</th>
              <th className="px-3 py-2 text-right font-medium">Finished</th>
              <th className="px-3 py-2 font-medium">Signed up</th>
              <th className="px-3 py-2 font-medium">Last active</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-[hsl(var(--muted-foreground))]">
                  No users match.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const display = r.display_name ?? (r.username ? `@${r.username}` : '—');
                return (
                  <tr key={r.id} className="border-t border-[hsl(var(--border))]">
                    <td className="px-3 py-2">
                      {r.username ? (
                        <Link
                          href={`/u/${r.username}`}
                          className="font-medium hover:underline"
                        >
                          {display}
                        </Link>
                      ) : (
                        <span className="text-[hsl(var(--muted-foreground))]">{display}</span>
                      )}
                      {r.username && (
                        <div className="text-xs text-[hsl(var(--muted-foreground))]">
                          @{r.username}
                          {r.role === 'admin' && (
                            <span className="ml-2 rounded bg-[hsl(var(--accent))]/15 px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--accent))]">
                              admin
                            </span>
                          )}
                          {!r.onboarded_at && (
                            <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                              not onboarded
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.email ? (
                        <button
                          type="button"
                          onClick={() => copyEmail(r)}
                          className="text-left font-mono text-xs hover:underline"
                          title="Click to copy"
                        >
                          {copiedId === r.id ? 'Copied ✓' : r.email}
                        </button>
                      ) : (
                        <span className="text-[hsl(var(--muted-foreground))]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-variant-numeric tabular-nums">
                      {r.saved_count}
                    </td>
                    <td className="px-3 py-2 text-right font-variant-numeric tabular-nums">
                      {r.finished_count}
                    </td>
                    <td className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                      {fmt.format(new Date(r.created_at))}
                    </td>
                    <td className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                      {r.last_active_at ? fmt.format(new Date(r.last_active_at)) : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
