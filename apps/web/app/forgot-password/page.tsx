'use client';

import Link from 'next/link';
import { useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type Status = 'idle' | 'submitting' | 'sent';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setStatus('submitting');
    const supabase = createSupabaseBrowserClient();
    // Use the current origin so this works on prod, preview, and local.
    const redirectTo = `${window.location.origin}/auth/reset-password`;
    const { error: err } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo },
    );
    // Anti-enumeration: even if `err` exists for "user not found", surface
    // the same generic success state. Only show errors for clearly
    // user-fixable problems (malformed email, rate limit).
    if (err && /invalid|rate/i.test(err.message)) {
      setStatus('idle');
      setError(err.message);
      return;
    }
    setStatus('sent');
  }

  const inputCls =
    'mt-1 block w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]';

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <h1 className="font-serif text-4xl font-medium tracking-tight">Reset password</h1>

      {status !== 'sent' ? (
        <>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            Enter your email and we&rsquo;ll send a link to set a new password.
          </p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <label className="block">
              <span className="text-sm font-medium">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === 'submitting'}
                placeholder="you@example.com"
                className={inputCls}
              />
            </label>
            <button
              type="submit"
              disabled={status === 'submitting' || !email.trim()}
              className="w-full rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-50"
            >
              {status === 'submitting' ? 'Sending…' : 'Send reset link'}
            </button>
          </form>

          {error && (
            <p className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600">
              {error}
            </p>
          )}

          <p className="mt-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
            <Link href="/login" className="underline hover:text-[hsl(var(--foreground))]">
              Back to sign in
            </Link>
          </p>
        </>
      ) : (
        <div className="mt-8">
          <p className="rounded-md border border-[hsl(var(--border))] p-4 text-sm">
            If <strong>{email}</strong> is registered with Zola, a reset link is on its way. Check your inbox (and spam) and click the link in the email to set a new password.
          </p>
          <p className="mt-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
            <Link href="/login" className="underline hover:text-[hsl(var(--foreground))]">
              Back to sign in
            </Link>
          </p>
        </div>
      )}
    </main>
  );
}
