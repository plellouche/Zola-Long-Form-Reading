import { isInviteRequired } from '@/lib/invite';

import { InviteGate } from './invite-gate';
import { SignupForm } from './signup-form';

export default async function SignupPage() {
  // Server-side decision so the gate is rendered on first paint without a
  // flash of "open signup" → "invite required".
  const gated = await isInviteRequired();
  if (gated) {
    return (
      <InviteGate>
        <SignupForm />
      </InviteGate>
    );
  }
  return <SignupForm />;
}
