'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getBrowserApiClient } from '@/lib/api';
import { ApiError } from '@longform/api-client';

type Source = { id: string; name: string; slug: string };
type Topic = { id: string; name: string; slug: string };
type UrlDraft = {
  canonical_url: string;
  title: string | null;
  description: string | null;
  author: string | null;
  publication_date: string | null;
  og_image_url: string | null;
};

export function NewArticleForm({ sources, topics }: { sources: Source[]; topics: Topic[] }) {
  const router = useRouter();
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [publicationDate, setPublicationDate] = useState('');
  const [canonicalUrl, setCanonicalUrl] = useState('');
  const [ogImageUrl, setOgImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [readingTime, setReadingTime] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Submit URL helper
  const [draftUrl, setDraftUrl] = useState('');
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  function toggleTopic(id: string) {
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleFetchDraft() {
    if (!draftUrl.trim()) return;
    setDraftLoading(true);
    setDraftError(null);
    try {
      const draft = await getBrowserApiClient().request<UrlDraft>('/api/ingest/url', {
        method: 'POST',
        body: { url: draftUrl.trim() },
      });
      setCanonicalUrl(draft.canonical_url);
      if (draft.title) setTitle(draft.title);
      if (draft.author) setAuthor(draft.author);
      if (draft.publication_date) setPublicationDate(draft.publication_date);
      if (draft.og_image_url) setOgImageUrl(draft.og_image_url);
      if (draft.description) setDescription(draft.description);
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = (err.body as { detail?: string } | null)?.detail;
        setDraftError(detail ?? err.message);
      } else {
        setDraftError('Could not fetch draft');
      }
    } finally {
      setDraftLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const created = await getBrowserApiClient().request<{ id: string }>('/api/articles', {
        method: 'POST',
        body: {
          source_id: sourceId,
          title: title.trim(),
          author: author.trim() || null,
          publication_date: publicationDate || null,
          canonical_url: canonicalUrl.trim(),
          og_image_url: ogImageUrl.trim() || null,
          description: description.trim() || null,
          reading_time_minutes: readingTime ? parseInt(readingTime, 10) : null,
          topic_ids: Array.from(selectedTopics),
        },
      });
      router.push(`/article/${created.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = (err.body as { detail?: string } | null)?.detail;
        setError(detail ?? err.message);
      } else {
        setError('Something went wrong.');
      }
      setSubmitting(false);
    }
  }

  const inputCls =
    'mt-1 block w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--foreground))]';

  return (
    <div className="mt-8">
      <section className="rounded-lg border border-dashed border-[hsl(var(--border))] p-4">
        <div className="text-sm font-medium">Submit URL</div>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          Paste an article URL to auto-fill below from OpenGraph metadata.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            type="url"
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            placeholder="https://..."
            className={inputCls + ' flex-1'}
          />
          <button
            type="button"
            onClick={handleFetchDraft}
            disabled={draftLoading || !draftUrl.trim()}
            className="mt-1 rounded-md bg-[hsl(var(--primary))] px-3 py-2 text-sm text-[hsl(var(--primary-foreground))] disabled:opacity-50"
          >
            {draftLoading ? 'Fetching…' : 'Fetch'}
          </button>
        </div>
        {draftError && (
          <p className="mt-2 text-xs text-red-600">{draftError}</p>
        )}
      </section>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Source</span>
          <select
            required
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className={inputCls}
          >
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium">Title</span>
          <input
            required
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={500}
            className={inputCls}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Canonical URL</span>
          <input
            required
            type="url"
            value={canonicalUrl}
            onChange={(e) => setCanonicalUrl(e.target.value)}
            placeholder="https://"
            className={inputCls}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium">Author</span>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Publication date</span>
            <input
              type="date"
              value={publicationDate}
              onChange={(e) => setPublicationDate(e.target.value)}
              className={inputCls}
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium">OG image URL</span>
          <input
            type="url"
            value={ogImageUrl}
            onChange={(e) => setOgImageUrl(e.target.value)}
            placeholder="https://"
            className={inputCls}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={3}
            className={inputCls}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Reading time (minutes)</span>
          <input
            type="number"
            min={0}
            max={600}
            value={readingTime}
            onChange={(e) => setReadingTime(e.target.value)}
            className={inputCls}
          />
        </label>

        <fieldset>
          <legend className="text-sm font-medium">Topics</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {topics.map((t) => {
              const selected = selectedTopics.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTopic(t.id)}
                  className={
                    'rounded-full border px-3 py-1 text-xs transition ' +
                    (selected
                      ? 'border-[hsl(var(--foreground))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                      : 'border-[hsl(var(--border))] hover:border-[hsl(var(--foreground))]')
                  }
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Create article'}
          </button>
          {error && (
            <p className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
