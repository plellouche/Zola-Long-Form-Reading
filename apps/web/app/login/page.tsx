'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type Mode = 'password' | 'otp-send' | 'otp-verify';
type Status = 'idle' | 'submitting';

/**
 * Primary flow: email + password.
 * Fallback: a 6-digit OTP code (the previous flow), kept for two reasons —
 *   1. Pre-Phase-11 accounts never set a password and need OTP to bootstrap.
 *   2. Some inboxes block emailed passwords/links; OTP code-only is robust.
 *
 * The Supabase email template renders ONLY the {{ .Token }}, no link, so
 * corporate email scanners can't prefetch and consume the token.
 */
export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('password');
  const [status, setStatus] = useState<Status>('idle');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function signInWithPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setStatus('submitting');
    const supabase = createSupabaseBrowserClient();
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (err) {
      setStatus('idle');
      // Anti-enumeration: do not differentiate "user not found" from "wrong password".
      setError('Email or password is incorrect.');
      return;
    }
    router.push('/');
    router.refresh();
  }

  async function sendOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setStatus('submitting');
    const supabase = createSupabaseBrowserClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
    });
    if (err) {
      setStatus('idle');
      setError(err.message);
      return;
    }
    setStatus('idle');
    setMode('otp-verify');
  }

  async function verifyOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setStatus('submitting');
    const supabase = createSupabaseBrowserClient();
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'email',
    });
    if (err) {
      setStatus('idle');
      setError(err.message);
      return;
    }
    router.push('/');
    router.refresh();
  }

  const inputCls =
    'mt-1 block w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]';

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <h1 className="font-serif text-4xl font-medium tracking-tight">Sign in</h1>

      {mode === 'password' && (
        <>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            Welcome back.
          </p>
          <form onSubmit={signInWithPassword} className="mt-8 space-y-4">
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
            <label className="block">
              <span className="text-sm font-medium">Password</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={status === 'submitting'}
                  className={`${inputCls} pr-16`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>
            <button
              type="submit"
              disabled={status === 'submitting' || !email.trim() || !password}
              className="w-full rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-50"
            >
              {status === 'submitting' ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-4 flex justify-between text-xs">
            <Link
              href="/forgot-password"
              className="text-[hsl(var(--muted-foreground))] underline hover:text-[hsl(var(--foreground))]"
            >
              Forgot password?
            </Link>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode('otp-send');
              }}
              className="text-[hsl(var(--muted-foreground))] underline hover:text-[hsl(var(--foreground))]"
            >
              Use email code instead
            </button>
          </div>

          <p className="mt-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
            New here?{' '}
            <Link href="/signup" className="underline hover:text-[hsl(var(--foreground))]">
              Create an account
            </Link>
          </p>
        </>
      )}

      {mode === 'otp-send' && (
        <>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            We&rsquo;ll email you a 6-digit code. No password.
          </p>
          <form onSubmit={sendOtp} className="mt-8 space-y-4">
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
              {status === 'submitting' ? 'Sending…' : 'Send code'}
            </button>
          </form>
          <div className="mt-4 flex justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                if (!email.trim()) {
                  setError('Enter your email first, then click this.');
                  return;
                }
                setError(null);
                setMode('otp-verify');
              }}
              className="text-[hsl(var(--muted-foreground))] underline hover:text-[hsl(var(--foreground))]"
            >
              I already have a code
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode('password');
              }}
              className="text-[hsl(var(--muted-foreground))] underline hover:text-[hsl(var(--foreground))]"
            >
              Use password instead
            </button>
          </div>
        </>
      )}

      {mode === 'otp-verify' && (
        <>
          <form onSubmit={verifyOtp} className="mt-8 space-y-4">
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
                disabled={status === 'submitting'}
                placeholder="123456"
                autoFocus
                className={`${inputCls} text-center text-lg tracking-[0.5em]`}
              />
            </label>
            <button
              type="submit"
              disabled={status === 'submitting' || code.length !== 6}
              className="w-full rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-50"
            >
              {status === 'submitting' ? 'Verifying…' : 'Sign in'}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode('otp-send');
                setCode('');
              }}
              className="block w-full text-center text-xs text-[hsl(var(--muted-foreground))] underline"
            >
              Use a different email
            </button>
          </form>
        </>
      )}

      {error && (
        <p className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </main>
  );
}
