'use client';

import { useState } from 'react';

import { getBrowserApiClient } from '@/lib/api';
import { ApiError } from '@longform/api-client';

type Result =
  | { ok: true; email: string }
  | { ok: false; message: string };

export function InviteForm() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      await getBrowserApiClient().request('/api/admin/invites', {
        method: 'POST',
        body: { email: email.trim().toLowerCase() },
      });
      setResult({ ok: true, email });
      setEmail('');
    } catch (err) {
      let message = 'Failed to send invite';
      if (err instanceof ApiError) {
        const detail = (err.body as { detail?: string } | null)?.detail;
        message = detail ?? err.message;
      }
      setResult({ ok: false, message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-[hsl(var(--border))] p-4"
    >
      <label className="flex flex-1 min-w-[220px] flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          Email address
        </span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          placeholder="someone@example.com"
          className="rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--foreground))]"
        />
      </label>
      <button
        type="submit"
        disabled={submitting || !email.trim()}
        className="rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm text-[hsl(var(--primary-foreground))] disabled:opacity-50"
      >
        {submitting ? 'Sending…' : 'Send invite'}
      </button>
      {result && result.ok && (
        <p className="basis-full rounded-md border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-700">
          Invite sent to <strong>{result.email}</strong>. They&rsquo;ll receive an email shortly.
        </p>
      )}
      {result && !result.ok && (
        <p className="basis-full rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600">
          {result.message}
        </p>
      )}
    </form>
  );
}
