'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type Step = 'email' | 'code' | 'sending' | 'verifying';

/**
 * Email + 6-digit OTP code flow.
 *
 * We use the code (not a magic link) because university/corporate email
 * scanners (Microsoft Defender, Proofpoint, Mimecast, etc.) prefetch every
 * URL in inbound mail to check for phishing, which consumes one-time-use
 * magic-link tokens before the user gets to click them. Codes can't be
 * consumed by visiting a URL.
 *
 * The Supabase magic-link email template was patched to render only the
 * `{{ .Token }}` (no link) so the email itself never contains a clickable
 * URL — there's nothing for a scanner to prefetch.
 */
export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setStep('sending');
    const supabase = createSupabaseBrowserClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
    });
    if (err) {
      setError(err.message);
      setStep('email');
    } else {
      setStep('code');
    }
  }

  async function verifyCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setStep('verifying');
    const supabase = createSupabaseBrowserClient();
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'email',
    });
    if (err) {
      setError(err.message);
      setStep('code');
    } else {
      router.push('/');
      router.refresh();
    }
  }

  const inputCls =
    'mt-1 block w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--foreground))]';

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
        We&rsquo;ll email you a 6-digit code. No password.
      </p>

      {step !== 'code' && step !== 'verifying' ? (
        <>
          <form onSubmit={sendCode} className="mt-8 space-y-4">
            <label className="block">
              <span className="text-sm font-medium">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={step === 'sending'}
                placeholder="you@example.com"
                className={inputCls}
              />
            </label>
            <button
              type="submit"
              disabled={step === 'sending' || !email.trim()}
              className="w-full rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-50"
            >
              {step === 'sending' ? 'Sending…' : 'Send code'}
            </button>
          </form>
          <button
            type="button"
            onClick={() => {
              if (!email.trim()) {
                setError('Enter your email first, then click this.');
                return;
              }
              setError(null);
              setStep('code');
            }}
            className="mt-4 block w-full text-center text-xs text-[hsl(var(--muted-foreground))] underline"
          >
            I already have a code from a previous email
          </button>
        </>
      ) : (
        <form onSubmit={verifyCode} className="mt-8 space-y-4">
          <p className="rounded-md border border-[hsl(var(--border))] p-3 text-sm">
            Enter the 6-digit code sent to <strong>{email}</strong>. It expires in 1 hour.
          </p>
          <label className="block">
            <span className="text-sm font-medium">Code</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              autoComplete="one-time-code"
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              disabled={step === 'verifying'}
              placeholder="123456"
              autoFocus
              className={`${inputCls} text-center text-lg tracking-[0.5em]`}
            />
          </label>
          <button
            type="submit"
            disabled={step === 'verifying' || code.length !== 6}
            className="w-full rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-50"
          >
            {step === 'verifying' ? 'Verifying…' : 'Sign in'}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep('email');
              setCode('');
              setError(null);
            }}
            className="block w-full text-center text-xs text-[hsl(var(--muted-foreground))] underline"
          >
            Use a different email
          </button>
        </form>
      )}

      {error && (
        <p className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </main>
  );
}
