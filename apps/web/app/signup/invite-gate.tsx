'use client';

import Link from 'next/link';
import { useState } from 'react';

import { validateInviteCode } from '@/lib/invite';

type Status = 'idle' | 'checking' | 'error';

/**
 * Gate shown before /signup when invite-only mode is on. Reveals the
 * underlying signup form (passed as `children`) once the user submits a
 * valid code.
 *
 * The validation server action lives in lib/invite.ts. The client never
 * sees the code list.
 */
export function InviteGate({ children }: { children: React.ReactNode }) {
  const [accepted, setAccepted] = useState(false);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('checking');
    const { ok } = await validateInviteCode(code);
    if (ok) {
      setAccepted(true);
      setStatus('idle');
    } else {
      setStatus('error');
    }
  }

  if (accepted) return <>{children}</>;

  const inputCls =
    'mt-1 block w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]';

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <h1 className="font-serif text-4xl font-medium tracking-tight">Zola is invite-only</h1>
      <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
        We&rsquo;re running a small beta. If a friend shared an invite code with you, enter it below.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Invite code</span>
          <input
            type="text"
            required
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={status === 'checking'}
            placeholder="words-go-here"
            className={inputCls}
          />
        </label>
        <button
          type="submit"
          disabled={status === 'checking' || !code.trim()}
          className="w-full rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-50"
        >
          {status === 'checking' ? 'Checking…' : 'Continue'}
        </button>
        {status === 'error' && (
          <p className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600">
            That code didn&rsquo;t match. Double-check, or ask the person who invited you.
          </p>
        )}
      </form>

      <p className="mt-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
        Already have an account?{' '}
        <Link href="/login" className="underline hover:text-[hsl(var(--foreground))]">
          Sign in
        </Link>
      </p>
    </main>
  );
}
