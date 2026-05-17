import { requireAdmin } from '@/lib/auth';
import { getServerApiClient } from '@/lib/server-api';

import { NewArticleForm } from './new-article-form';

type Source = { id: string; name: string; slug: string; content_policy: string };
type Topic = { id: string; name: string; slug: string };

export default async function NewArticlePage() {
  await requireAdmin();
  const api = getServerApiClient();
  const [sources, topics] = await Promise.all([
    api.request<Source[]>('/api/sources', { query: { active: 'true' } }),
    api.request<Topic[]>('/api/topics'),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">New article</h1>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
        Manual entry. The OG-fetch / submit-URL flow lands in Phase 3.
      </p>
      <NewArticleForm sources={sources} topics={topics} />
    </main>
  );
}
