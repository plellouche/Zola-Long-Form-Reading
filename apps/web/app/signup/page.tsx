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

type Status = 'idle' | 'submitting';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const strength: PasswordStrength | null = useMemo(
    () => (password ? estimateStrength(password) : null),
    [password],
  );

  const lengthOk = password.length >= MIN_PASSWORD_LENGTH;
  const canSubmit =
    email.trim().length > 3 &&
    lengthOk &&
    strength !== null &&
    strength.score >= 2 &&
    status === 'idle';

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setStatus('submitting');
    const supabase = createSupabaseBrowserClient();
    const { error: err } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    });
    if (err) {
      setStatus('idle');
      // Common error: "User already registered"
      const msg = err.message.toLowerCase().includes('already')
        ? 'An account with this email already exists.'
        : err.message;
      setError(msg);
      return;
    }
    // Email confirmation is disabled, so the user is signed in immediately.
    router.push('/onboarding');
    router.refresh();
  }

  const inputCls =
    'mt-1 block w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]';

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <h1 className="font-serif text-4xl font-medium tracking-tight">
        Create your account
      </h1>
      <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
        Email and a password. No verification step, you&rsquo;re in immediately.
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

        <label className="block">
          <span className="text-sm font-medium">Password</span>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={status === 'submitting'}
              minLength={MIN_PASSWORD_LENGTH}
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
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

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-50"
        >
          {status === 'submitting' ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <p className="mt-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
        Already have an account?{' '}
        <Link href="/login" className="underline hover:text-[hsl(var(--foreground))]">
          Sign in
        </Link>
      </p>
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
  // Color bars 0..4 based on score. Always render 4 bars; fill the first N+1.
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
