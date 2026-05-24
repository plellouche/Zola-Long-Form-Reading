import Link from 'next/link';

import { getServerApiClient } from '@/lib/server-api';
import type { SourceBrief } from '@/lib/api-types';
import { ApiError } from '@longform/api-client';

/**
 * Horizontal source-name marquee. CSS-only animation (no JS). The list is
 * duplicated in DOM so the loop is seamless.
 *
 * Resilient: if the API is cold-starting or down, the band silently renders
 * nothing rather than crashing the landing page.
 */
export async function SourceBand() {
  let sources: SourceBrief[] = [];
  try {
    sources = await getServerApiClient().request<SourceBrief[]>('/api/sources', {
      query: { active: 'true' },
    });
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    return null;
  }
  // Sort by name for stability; cap at 30 so it doesn't get absurd.
  const items = sources
    .map((s) => ({ id: s.id, slug: s.slug, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 30);

  if (items.length === 0) return null;

  return (
    <section
      aria-label="Curated sources"
      className="border-y border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 py-6"
    >
      <div className="text-center text-xs uppercase tracking-[0.18em] text-[hsl(var(--accent))]">
        Curating from {items.length} publications
      </div>
      <div
        className="group relative mt-4 overflow-hidden"
        style={{ maskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)' }}
      >
        <div className="flex w-max animate-marquee gap-10 px-6">
          {[...items, ...items].map((s, i) => (
            <Link
              key={`${s.id}-${i}`}
              href={`/source/${s.slug}`}
              className="shrink-0 whitespace-nowrap font-serif text-xl tracking-tight text-[hsl(var(--foreground))]/80 transition hover:text-[hsl(var(--primary))]"
            >
              {s.name}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
