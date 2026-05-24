'use server';

/**
 * Server-side invite-code validation.
 *
 * Codes live in the `ZOLA_INVITE_CODES` env var on the server (comma-separated;
 * never NEXT_PUBLIC_*). The client never sees the full list — it submits a
 * single guess to `validateInviteCode` and receives ok|not-ok.
 *
 * This is intentionally crude. Codes are doormat security: anyone can share a
 * code, and there's no per-code limit or single-use tracking. That's fine for
 * an invite-only beta — the goal is to slow down random internet, not to
 * defend against motivated attackers.
 */

const NORMALIZE = /[\s,]+/g;

function configuredCodes(): string[] {
  const raw = process.env.ZOLA_INVITE_CODES ?? '';
  return raw
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c.length > 0);
}

export async function isInviteRequired(): Promise<boolean> {
  // Public flag — also exposed via NEXT_PUBLIC_INVITE_REQUIRED for client-side
  // first-paint decisions, but we re-check server-side here so a tampered
  // client can't bypass it.
  return process.env.NEXT_PUBLIC_INVITE_REQUIRED === 'true';
}

export async function validateInviteCode(code: string): Promise<{ ok: boolean }> {
  if (!(await isInviteRequired())) {
    return { ok: true };
  }
  const trimmed = code.trim().toLowerCase();
  if (!trimmed) return { ok: false };
  const codes = configuredCodes();
  return { ok: codes.includes(trimmed) };
}
