import Link from 'next/link';

import { CreateListForm } from './create-list-form';
import { EmptyState } from '@/components/empty-state';
import { requireUser } from '@/lib/auth';
import { getServerApiClient } from '@/lib/server-api';
import type { ReadingList } from '@/lib/api-types';

function ListCard({ list, ownerLabel }: { list: ReadingList; ownerLabel?: string }) {
  return (
    <Link
      href={`/list/${list.id}`}
      className="block rounded-lg border border-[hsl(var(--border))] p-4 transition hover:border-[hsl(var(--foreground))]"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-medium leading-snug">{list.title}</h2>
        <span className="shrink-0 text-xs text-[hsl(var(--muted-foreground))]">
          {list.item_count} {list.item_count === 1 ? 'article' : 'articles'}
        </span>
      </div>
      {list.description && (
        <p className="mt-2 line-clamp-2 text-sm text-[hsl(var(--muted-foreground))]">
          {list.description}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
        {ownerLabel && (
          <>
            <span>{ownerLabel}</span>
            <span>·</span>
          </>
        )}
        <span>{list.is_public ? 'Public' : 'Private'}</span>
        <span>·</span>
        <span>Updated {new Date(list.updated_at).toLocaleDateString()}</span>
      </div>
    </Link>
  );
}

export default async function MyListsPage() {
  await requireUser();
  const api = getServerApiClient();
  const [myLists, following] = await Promise.all([
    api.request<ReadingList[]>('/api/lists', { query: { mine: 'true' } }),
    api.request<ReadingList[]>('/api/lists', { query: { following: 'true' } }),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Lists</h1>
        <span className="text-sm text-[hsl(var(--muted-foreground))]">
          {myLists.length} mine · {following.length} following
        </span>
      </div>

      <CreateListForm />

      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          My lists
        </h2>
        {myLists.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="No lists yet."
              body="Create one above, or add articles to a new list from any article page."
            />
          </div>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {myLists.map((l) => (
              <li key={l.id}>
                <ListCard list={l} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {following.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            From people you follow
          </h2>
          <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {following.map((l) => (
              <li key={l.id}>
                <ListCard list={l} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
