import { redirect } from 'next/navigation';

import { requireUser } from '@/lib/auth';
import { getServerApiClient } from '@/lib/server-api';
import { ApiError } from '@longform/api-client';

import { OnboardingForm } from './onboarding-form';

type ProfileMe = { onboarded_at: string | null; username: string | null };
type Topic = { id: string; name: string; slug: string; description: string | null };

export default async function OnboardingPage() {
  await requireUser();
  const api = getServerApiClient();

  let profile: ProfileMe;
  let topics: Topic[];
  try {
    [profile, topics] = await Promise.all([
      api.request<ProfileMe>('/api/users/me'),
      api.request<Topic[]>('/api/topics'),
    ]);
  } catch (err) {
    // Stale or invalid session: bounce to /login so Supabase reissues a token.
    if (err instanceof ApiError && err.status === 401) {
      redirect('/login?next=/onboarding');
    }
    throw err;
  }

  if (profile.onboarded_at) {
    redirect('/');
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-serif text-4xl font-medium tracking-tight">Welcome to Zola</h1>
      <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
        Pick a username and a few topics you&rsquo;d like to read about. You can change these later.
      </p>
      <OnboardingForm topics={topics} />
    </main>
  );
}
