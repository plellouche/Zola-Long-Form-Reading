import { redirect } from 'next/navigation';

import { requireUser } from '@/lib/auth';
import { getServerApiClient } from '@/lib/server-api';

import { SettingsForm } from './settings-form';

type ProfileMe = {
  username: string | null;
  display_name: string | null;
  bio: string | null;
  onboarded_at: string | null;
};

export default async function SettingsPage() {
  await requireUser();
  const profile = await getServerApiClient().request<ProfileMe>('/api/users/me');

  if (!profile.onboarded_at) {
    redirect('/onboarding');
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
        @{profile.username}
      </p>
      <SettingsForm
        initialDisplayName={profile.display_name ?? ''}
        initialBio={profile.bio ?? ''}
      />
    </main>
  );
}
