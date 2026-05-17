import { redirect } from 'next/navigation';

import { requireUser } from '@/lib/auth';
import { getServerApiClient } from '@/lib/server-api';

import { OnboardingForm } from './onboarding-form';

type ProfileMe = { onboarded_at: string | null; username: string | null };
type Topic = { id: string; name: string; slug: string; description: string | null };

export default async function OnboardingPage() {
  await requireUser();
  const api = getServerApiClient();

  const [profile, topics] = await Promise.all([
    api.request<ProfileMe>('/api/users/me'),
    api.request<Topic[]>('/api/topics'),
  ]);

  if (profile.onboarded_at) {
    redirect('/');
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Welcome to Longform</h1>
      <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
        Pick a username and a few topics you&rsquo;d like to read about. You can change these later.
      </p>
      <OnboardingForm topics={topics} />
    </main>
  );
}
