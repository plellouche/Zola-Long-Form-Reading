import { redirect } from 'next/navigation';

import { AvatarUploader } from '@/components/avatar-uploader';
import { requireUser } from '@/lib/auth';
import { getServerApiClient } from '@/lib/server-api';

import { ChangePasswordForm } from './change-password-form';
import { SettingsForm } from './settings-form';

type ProfileMe = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  discoverable: boolean;
  onboarded_at: string | null;
};

export default async function SettingsPage() {
  const user = await requireUser();
  const profile = await getServerApiClient().request<ProfileMe>('/api/users/me');

  if (!profile.onboarded_at) {
    redirect('/onboarding');
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="font-serif text-4xl font-medium tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
        @{profile.username}
      </p>

      <section className="mt-8">
        <h2 className="text-sm font-medium">Profile photo</h2>
        <div className="mt-3">
          <AvatarUploader
            userId={profile.id}
            username={profile.username ?? '?'}
            initialAvatarUrl={profile.avatar_url}
          />
        </div>
      </section>

      <SettingsForm
        initialDisplayName={profile.display_name ?? ''}
        initialBio={profile.bio ?? ''}
        initialDiscoverable={profile.discoverable ?? false}
      />

      {user.email && (
        <section className="mt-12 border-t border-[hsl(var(--border))] pt-8">
          <h2 className="text-sm font-medium">Change password</h2>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            Signed in as {user.email}.
          </p>
          <div className="mt-4">
            <ChangePasswordForm email={user.email} />
          </div>
        </section>
      )}
    </main>
  );
}
