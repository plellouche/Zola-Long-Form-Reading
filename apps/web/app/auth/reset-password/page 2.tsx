'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  MIN_PASSWORD_LENGTH,
  estimateStrength,
  strengthLabel,
  type PasswordStrength,
} from '@/lib/password';

type Phase = 'initializing' | 'invalid' | 'ready' | 'submitting' | 'done';

/**
 * Landing page from the password-recovery email. Supabase delivers the
 * access token in the URL fragment (`#access_token=…&refresh_token=…&type=recovery`).
 * We parse it locally, call setSession, then surface the new-password form.
 *
 * We don't rely on the global AuthFragmentHandler because we need to know
 * whether session setup succeeded before showing the form (race-free).
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('initializing');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (!hash || hash.length < 2) {
      // No fragment — maybe user navigated here directly without an email.
      // Could also be that AuthFragmentHandler already consumed the fragment
      // before we ran; in that case the session should exist.
      void verifySession();
      return;
    }
    const params = new URLSearchParams(hash.slice(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const errorCode = params.get('error') || params.get('error_code');

    if (errorCode || !accessToken || !refreshToken) {
      setPhase('invalid');
      return;
    }

    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { error: err } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      // Clean the fragment regardless of outcome.
      window.history.replaceState(null, '', window.location.pathname);
      if (err) {
        setPhase('invalid');
      } else {
        setPhase('ready');
      }
    })();

    async function verifySession() {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      setPhase(data.session ? 'ready' : 'invalid');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const strength: PasswordStrength | null = useMemo(
    () => (password ? estimateStrength(password) : null),
    [password],
  );
  const lengthOk = password.length >= MIN_PASSWORD_LENGTH;
  const matches = password.length > 0 && password === confirm;
  const canSubmit =
    phase === 'ready' &&
    lengthOk &&
    strength !== null &&
    strength.score >= 2 &&
    matches;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPhase('submitting');
    const supabase = createSupabaseBrowserClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setPhase('ready');
      setError(err.message);
      return;
    }
    // Sign out the recovery-scoped session so the user re-authenticates
    // properly with their new password.
    await supabase.auth.signOut();
    setPhase('done');
    setTimeout(() => {
      router.push('/login');
      router.refresh();
    }, 1500);
  }

  const inputCls =
    'mt-1 block w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]';

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <h1 className="font-serif text-4xl font-medium tracking-tight">Set a new password</h1>

      {phase === 'initializing' && (
        <p className="mt-8 text-sm text-[hsl(var(--muted-foreground))]">
          Verifying your reset link…
        </p>
      )}

      {phase === 'invalid' && (
        <div className="mt-8">
          <p className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600">
            This reset link is invalid or has expired. Request a new one.
          </p>
          <p className="mt-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
            <Link
              href="/forgot-password"
              className="underline hover:text-[hsl(var(--foreground))]"
            >
              Start over
            </Link>
          </p>
        </div>
      )}

      {(phase === 'ready' || phase === 'submitting') && (
        <>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            Pick a new password. You&rsquo;ll sign in with this from now on.
          </p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <label className="block">
              <span className="text-sm font-medium">New password</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={phase === 'submitting'}
                  minLength={MIN_PASSWORD_LENGTH}
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

            {password && strength && (
              <StrengthMeter strength={strength} lengthOk={lengthOk} />
            )}

            <label className="block">
              <span className="text-sm font-medium">Confirm password</span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={phase === 'submitting'}
                className={inputCls}
              />
              {confirm && !matches && (
                <span className="mt-1 block text-xs text-red-600">
                  Passwords don&rsquo;t match.
                </span>
              )}
            </label>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-50"
            >
              {phase === 'submitting' ? 'Updating…' : 'Update password'}
            </button>
          </form>

          {error && (
            <p className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600">
              {error}
            </p>
          )}
        </>
      )}

      {phase === 'done' && (
        <p className="mt-8 rounded-md border border-[hsl(var(--border))] p-4 text-sm">
          Password updated. Redirecting you to sign in…
        </p>
      )}
    </main>
  );
}

function StrengthMeter({
  strength,
  lengthOk,
}: {
  strength: PasswordStrength;
  lengthOk: boolean;
}) {
  const filled = strength.score + 1;
  const colorFor = (score: PasswordStrength['score']) => {
    if (score === 0) return 'bg-red-500';
    if (score === 1) return 'bg-orange-500';
    if (score === 2) return 'bg-yellow-500';
    if (score === 3) return 'bg-emerald-500';
    return 'bg-[hsl(var(--accent))]';
  };
  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded ${
              i < filled ? colorFor(strength.score) : 'bg-[hsl(var(--border))]'
            }`}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-[hsl(var(--muted-foreground))]">
          {strengthLabel(strength.score)}
          {!lengthOk && ` · needs ≥${MIN_PASSWORD_LENGTH} chars`}
        </span>
        {strength.feedback && (
          <span className="ml-2 truncate text-[hsl(var(--muted-foreground))]">
            {strength.feedback}
          </span>
        )}
      </div>
    </div>
  );
}
