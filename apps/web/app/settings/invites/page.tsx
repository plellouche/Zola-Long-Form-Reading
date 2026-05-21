import Link from 'next/link';

import { requireAdmin } from '@/lib/auth';

import { InviteForm } from './invite-form';

export const metadata = { title: 'Invites' };

export default async function AdminInvitesPage() {
  await requireAdmin();

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <Link href="/settings/sources" className="text-sm text-[hsl(var(--muted-foreground))]">
        ← Admin
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Invites</h1>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
        Send a sign-in email to a specific address. They&rsquo;ll get a Longform invite from{' '}
        <code className="text-xs">onboarding@resend.dev</code> (or your configured Resend sender).
      </p>

      <InviteForm />

      <section className="mt-10 rounded-lg border border-[hsl(var(--border))] p-4 text-sm text-[hsl(var(--muted-foreground))]">
        <p>
          <strong className="text-[hsl(var(--foreground))]">How it works</strong>
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Uses Supabase&rsquo;s admin <code className="text-xs">invite</code> endpoint to create a pending user and email them an invite link.</li>
          <li>Bypasses the regular Supabase rate limit (you&rsquo;re acting as admin).</li>
          <li>If the email is already on file, you&rsquo;ll get a 409 — switch to the regular login flow instead.</li>
        </ul>
      </section>
    </main>
  );
}
