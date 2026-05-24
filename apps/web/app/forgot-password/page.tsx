'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  MIN_PASSWORD_LENGTH,
  estimateStrength,
  strengthLabel,
  type PasswordStrength,
} from '@/lib/password';

type Phase = 'request' | 'requesting' | 'reset' | 'resetting' | 'done';

/**
 * Two-step single-page password reset.
 *
 * Step 1: enter email -> Supabase sends a 6-digit recovery code to email.
 * Step 2: enter code + new password -> verifyOtp({type: 'recovery'}) + updateUser.
 *
 * Why a code, not a clickable link: corporate / university email scanners
 * (UMich Proofpoint, Microsoft Defender, Mimecast, etc.) prefetch every URL
 * in inbound mail to check for phishing, which consumes one-time-use tokens
 * before the user can click them. The OTP /login flow already worked around
 * this for sign-in; we apply the same fix here for password reset.
 *
 * The matching Supabase email template must render only `{{ .Token }}`, no
 * clickable links — configure at Authentication > Email Templates > Reset Password.
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength: PasswordStrength | null = useMemo(
    () => (password ? estimateStrength(password) : null),
    [password],
  );
  const lengthOk = password.length >= MIN_PASSWORD_LENGTH;
  const matches = password.length > 0 && password === confirm;
  const canReset =
    phase === 'reset' &&
    code.length === 6 &&
    lengthOk &&
    strength !== null &&
    strength.score >= 2 &&
    matches;

  async function requestCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPhase('requesting');
    const supabase = createSupabaseBrowserClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
    );
    // Anti-enumeration: surface generic success even on "user not found".
    if (err && /invalid|rate/i.test(err.message)) {
      setPhase('request');
      setError(err.message);
      return;
    }
    setPhase('reset');
  }

  async function resetPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPhase('resetting');
    const supabase = createSupabaseBrowserClient();
    // verifyOtp with type 'recovery' exchanges the code for a session
    // scoped to password recovery, which lets us call updateUser.
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'recovery',
    });
    if (verifyErr) {
      setPhase('reset');
      setError('Code is invalid or has expired. Request a new one.');
      return;
    }
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    if (updateErr) {
      setPhase('reset');
      setError(updateErr.message);
      return;
    }
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
      <h1 className="font-serif text-4xl font-medium tracking-tight">Reset password</h1>

      {(phase === 'request' || phase === 'requesting') && (
        <>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            Enter your email. We&rsquo;ll send a 6-digit code to set a new password.
          </p>
          <form onSubmit={requestCode} className="mt-8 space-y-4">
            <label className="block">
              <span className="text-sm font-medium">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={phase === 'requesting'}
                placeholder="you@example.com"
                className={inputCls}
              />
            </label>
            <button
              type="submit"
              disabled={phase === 'requesting' || !email.trim()}
              className="w-full rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-50"
            >
              {phase === 'requesting' ? 'Sending…' : 'Send code'}
            </button>
          </form>
          <p className="mt-4 text-center text-sm">
            <Link
              href="/login"
              className="text-[hsl(var(--muted-foreground))] underline hover:text-[hsl(var(--foreground))]"
            >
              Back to sign in
            </Link>
          </p>
        </>
      )}

      {(phase === 'reset' || phase === 'resetting') && (
        <>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            If <strong>{email}</strong> is registered, a 6-digit code is on its way (check spam too). Paste it below and choose a new password.
          </p>
          <form onSubmit={resetPassword} className="mt-8 space-y-4">
            <label className="block">
              <span className="text-sm font-medium">Code from email</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                autoComplete="one-time-code"
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                disabled={phase === 'resetting'}
                placeholder="123456"
                className={`${inputCls} text-center text-lg tracking-[0.5em]`}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">New password</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={phase === 'resetting'}
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
                disabled={phase === 'resetting'}
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
              disabled={!canReset}
              className="w-full rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-50"
            >
              {phase === 'resetting' ? 'Updating…' : 'Set new password'}
            </button>
            <button
              type="button"
              onClick={() => {
                setPhase('request');
                setCode('');
                setPassword('');
                setConfirm('');
                setError(null);
              }}
              className="block w-full text-center text-xs text-[hsl(var(--muted-foreground))] underline"
            >
              Use a different email
            </button>
          </form>
        </>
      )}

      {phase === 'done' && (
        <p className="mt-8 rounded-md border border-[hsl(var(--border))] p-4 text-sm">
          Password updated. Redirecting you to sign in…
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600">
          {error}
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
