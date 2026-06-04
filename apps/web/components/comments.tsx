'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';

import { Avatar } from '@/components/avatar';
import { getBrowserApiClient } from '@/lib/api';
import { ApiError } from '@longform/api-client';

type Author = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type CommentRow = {
  id: string;
  article_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author: Author;
  can_delete: boolean;
};

type Props = {
  articleId: string;
  initial: CommentRow[];
  signedIn: boolean;
};

const MAX = 2000;

export function Comments({ articleId, initial, signedIn }: Props) {
  const router = useRouter();
  const [comments, setComments] = useState<CommentRow[]>(initial);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Sync from server-rendered initial if it changes (router.refresh case).
  useEffect(() => setComments(initial), [initial]);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = body.trim();
      if (!trimmed || submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        const created = await getBrowserApiClient().request<CommentRow>(
          `/api/articles/${articleId}/comments`,
          { method: 'POST', body: { body: trimmed } },
        );
        setComments((prev) => [...prev, created]);
        setBody('');
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to post.');
      } finally {
        setSubmitting(false);
      }
    },
    [articleId, body, submitting],
  );

  async function remove(id: string) {
    if (!confirm('Delete this comment?')) return;
    const prev = comments;
    setComments((cs) => cs.filter((c) => c.id !== id));
    try {
      await getBrowserApiClient().request(`/api/comments/${id}`, { method: 'DELETE' });
    } catch {
      setComments(prev);
      setError('Could not delete.');
    }
  }

  return (
    <section className="mt-16 border-t border-[hsl(var(--border))] pt-8">
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="font-serif text-2xl font-medium tracking-tight">
          {comments.length === 0
            ? 'Comments'
            : `${comments.length} comment${comments.length === 1 ? '' : 's'}`}
        </h2>
      </header>

      {comments.length === 0 ? (
        <p className="mb-6 text-sm text-[hsl(var(--muted-foreground))]">
          No comments yet.
        </p>
      ) : (
        <ol className="mb-8 space-y-5">
          {comments.map((c) => {
            const display = c.author.display_name ?? `@${c.author.username}`;
            const when = new Date(c.created_at).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            });
            return (
              <li key={c.id} className="flex gap-3">
                <Link href={`/u/${c.author.username}`} className="shrink-0">
                  <Avatar
                    src={c.author.avatar_url}
                    name={display}
                    seed={c.author.id}
                    size="sm"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <Link
                      href={`/u/${c.author.username}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {display}
                    </Link>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      @{c.author.username} · {when}
                    </span>
                    {c.can_delete && (
                      <button
                        type="button"
                        onClick={() => remove(c.id)}
                        className="ml-auto text-xs text-[hsl(var(--muted-foreground))] hover:text-red-600"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed">
                    {linkify(c.body)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {signedIn ? (
        <form onSubmit={submit} className="space-y-2">
          <textarea
            ref={taRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment…"
            rows={3}
            maxLength={MAX}
            className="block w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              {body.length}/{MAX}
            </span>
            <button
              type="submit"
              disabled={!body.trim() || submitting}
              className="rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-50"
            >
              {submitting ? 'Posting…' : 'Post'}
            </button>
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </form>
      ) : (
        <p className="rounded-md border border-dashed border-[hsl(var(--border))] p-4 text-sm text-[hsl(var(--muted-foreground))]">
          <Link href="/login" className="underline">
            Sign in
          </Link>{' '}
          to comment.
        </p>
      )}
    </section>
  );
}

/** Plain-text body -> React fragments with bare URLs wrapped in <a>. */
function linkify(body: string): React.ReactNode {
  // split() with a capturing group returns split parts AND captures
  // interleaved; the URL substrings are guaranteed to start with http(s)://
  // so we can identify them with a cheap prefix check (no stateful /g regex).
  const URL_RE = /(https?:\/\/[^\s)]+[^\s.,)\]])/g;
  const parts = body.split(URL_RE);
  return parts.map((part, i) => {
    if (part && /^https?:\/\//.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noreferrer noopener"
          className="text-[hsl(var(--primary))] underline hover:no-underline"
        >
          {part}
        </a>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}
