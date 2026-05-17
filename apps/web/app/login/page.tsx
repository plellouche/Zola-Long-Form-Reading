'use client';

import { useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type Status = 'idle' | 'sending' | 'sent' | 'error';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('sending');
    setErrorMessage(null);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus('error');
      setErrorMessage(error.message);
    } else {
      setStatus('sent');
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
        We&rsquo;ll email you a magic link. No password required.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === 'sending' || status === 'sent'}
            placeholder="you@example.com"
            className="mt-1 block w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--foreground))]"
          />
        </label>

        <button
          type="submit"
          disabled={status === 'sending' || status === 'sent'}
          className="w-full rounded-md bg-[hsl(var(--foreground))] px-4 py-2 text-sm font-medium text-[hsl(var(--background))] disabled:opacity-50"
        >
          {status === 'sending' ? 'Sending…' : status === 'sent' ? 'Check your email' : 'Send magic link'}
        </button>

        {status === 'sent' && (
          <p className="rounded-md border border-[hsl(var(--border))] p-3 text-sm">
            A sign-in link was sent to <strong>{email}</strong>. Open it on this device to continue.
          </p>
        )}
        {status === 'error' && errorMessage && (
          <p className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600">
            {errorMessage}
          </p>
        )}
      </form>
    </main>
  );
}
