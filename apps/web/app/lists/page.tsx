import Link from 'next/link';

import { CreateListForm } from './create-list-form';
import { requireUser } from '@/lib/auth';
import { getServerApiClient } from '@/lib/server-api';
import type { ReadingList } from '@/lib/api-types';

export default async function MyListsPage() {
  await requireUser();
  const lists = await getServerApiClient().request<ReadingList[]>('/api/lists', {
    query: { mine: 'true' },
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">My lists</h1>
        <span className="text-sm text-[hsl(var(--muted-foreground))]">{lists.length} list{lists.length === 1 ? '' : 's'}</span>
      </div>

      <CreateListForm />

      {lists.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-[hsl(var(--border))] p-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
          No lists yet. Create one above, or add articles to a new list from any article page.
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {lists.map((l) => (
            <li key={l.id}>
              <Link
                href={`/list/${l.id}`}
                className="block rounded-lg border border-[hsl(var(--border))] p-4 transition hover:border-[hsl(var(--foreground))]"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-medium leading-snug">{l.title}</h2>
                  <span className="shrink-0 text-xs text-[hsl(var(--muted-foreground))]">
                    {l.item_count} {l.item_count === 1 ? 'article' : 'articles'}
                  </span>
                </div>
                {l.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-[hsl(var(--muted-foreground))]">
                    {l.description}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                  <span>{l.is_public ? 'Public' : 'Private'}</span>
                  <span>·</span>
                  <span>Updated {new Date(l.updated_at).toLocaleDateString()}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
