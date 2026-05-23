'use client';

import { useMemo, useState } from 'react';

import { useToast } from '@/components/toast';
import {
  MIN_PASSWORD_LENGTH,
  estimateStrength,
  strengthLabel,
  type PasswordStrength,
} from '@/lib/password';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type Status = 'idle' | 'submitting';

export function ChangePasswordForm({ email }: { email: string }) {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const strength: PasswordStrength | null = useMemo(
    () => (next ? estimateStrength(next) : null),
    [next],
  );
  const lengthOk = next.length >= MIN_PASSWORD_LENGTH;
  const matches = next.length > 0 && next === confirm;
  const differs = next !== current;
  const canSubmit =
    status === 'idle' &&
    current.length > 0 &&
    lengthOk &&
    strength !== null &&
    strength.score >= 2 &&
    matches &&
    differs;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setStatus('submitting');
    const supabase = createSupabaseBrowserClient();

    // Verify current password by attempting a sign-in. Supabase doesn't have
    // a dedicated "verify password" endpoint; a successful signInWithPassword
    // is the canonical way to confirm the user knows their current password.
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    });
    if (signInErr) {
      setStatus('idle');
      setError('Current password is incorrect.');
      return;
    }

    const { error: updateErr } = await supabase.auth.updateUser({
      password: next,
    });
    if (updateErr) {
      setStatus('idle');
      setError(updateErr.message);
      toast.show('Could not update password', { kind: 'error' });
      return;
    }

    setStatus('idle');
    setCurrent('');
    setNext('');
    setConfirm('');
    toast.show('Password updated');
  }

  const inputCls =
    'mt-1 block w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          tabIndex={-1}
          className="text-xs text-[hsl(var(--muted-foreground))] underline hover:text-[hsl(var(--foreground))]"
        >
          {showAll ? 'Hide passwords' : 'Show passwords'}
        </button>
      </div>
      <label className="block">
        <span className="text-sm font-medium">Current password</span>
        <input
          type={showAll ? 'text' : 'password'}
          required
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          disabled={status === 'submitting'}
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">New password</span>
        <input
          type={showAll ? 'text' : 'password'}
          required
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          disabled={status === 'submitting'}
          minLength={MIN_PASSWORD_LENGTH}
          className={inputCls}
        />
      </label>

      {next && strength && (
        <StrengthMeter strength={strength} lengthOk={lengthOk} />
      )}

      <label className="block">
        <span className="text-sm font-medium">Confirm new password</span>
        <input
          type={showAll ? 'text' : 'password'}
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={status === 'submitting'}
          className={inputCls}
        />
        {confirm && !matches && (
          <span className="mt-1 block text-xs text-red-600">
            Passwords don&rsquo;t match.
          </span>
        )}
        {differs === false && next && (
          <span className="mt-1 block text-xs text-red-600">
            New password must differ from current.
          </span>
        )}
      </label>

      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-50"
      >
        {status === 'submitting' ? 'Updating…' : 'Update password'}
      </button>

      {error && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
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
