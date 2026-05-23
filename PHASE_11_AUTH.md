# Phase 11 — Username + Password Auth

> Replace OTP-only sign-in with email + password as the primary flow. OTP / magic-link stays in the codebase for two specific uses (password reset, optional fallback). The dev shortcut `/dev/sign-in-as` stays for local convenience.

> **Why now**: production OTP delivery via Supabase free-tier email is unreliable (rate-limited; the current "Error sending magic link email" on prod). Even when it works, OTP forces email round-trip on every sign-in — friction for returning users. Password sign-in is what people expect for a content app.

---

## 1. Decisions to lock in upfront

Three branch points. I'd like your call on each before implementation; they meaningfully change scope.

### 1.1 Email confirmation: required or optional?

Supabase Auth has a "Confirm email" toggle. With it on, users can't sign in until they click the verification link in their first email. With it off, they're signed in immediately after `signUp`.

**Recommendation: OFF for the invite-only beta.**

- ✅ Frictionless signup (~1 minute total from landing page → in-product)
- ✅ One fewer email-delivery dependency (you saw how unreliable it is right now)
- ⚠️ Slightly higher signup-spam risk — but with invite-only mode this is moot
- ⚠️ Some emails could be typos that never own the address — minor risk because we don't send transactional email yet

Flip it ON later when you go public + before sending any transactional emails to user inboxes.

### 1.2 OAuth providers (Google / GitHub): include now or defer?

Adding Google / GitHub sign-in is straightforward with Supabase (1-2 hours of work + provider OAuth-app setup) and dramatically improves the "first-impression" feel.

**Recommendation: defer to Phase 11.5.**

- The full plumbing (Sign in with Google button, redirect handling, account-linking) is non-trivial
- Worth its own focused pass once email/password is working
- Account-linking edge cases (user signs up with Google, then later with email/password using the same email) are subtle and easier to address with email/password already shipped

If you'd rather include Google now, say so — it adds maybe a half-day to this phase.

### 1.3 Password complexity rules

What's required for a valid password?

**Recommendation**: minimum 12 characters, no other restrictions. Modern guidance (NIST SP 800-63B) explicitly rejects "must have uppercase + number + symbol" rules — they push users toward `Password1!` style passwords that are weaker. Long passphrases are the goal.

We'll show a strength estimate (using `zxcvbn-ts` — small, free, well-maintained) to nudge users toward stronger picks without blocking them on rules.

Approve or override.

---

## 2. Scope

### 2.1 What changes

| Surface | Change |
|---|---|
| `/login` | Replace OTP form with email + password form. Add "Forgot password?" link. Keep "Sign in with email code" as a small fallback link for users who want OTP. |
| `/signup` (new) | Email + password, with strength meter. On submit, calls `supabase.auth.signUp` and lands the user on `/onboarding`. |
| `/forgot-password` (new) | Single email field. Calls `supabase.auth.resetPasswordForEmail` with redirect to `/auth/reset-password`. |
| `/auth/reset-password` (new) | Landing page from the reset email. New-password + confirm-password fields. Calls `supabase.auth.updateUser({password})`. |
| `/settings` | Add a "Change password" section: current password + new password + confirm. |
| `/auth/callback` | Already exists for OTP-magic-link. Stays for the password-reset flow (same code path; the URL fragment carries an access_token from the reset email). |
| Onboarding page | Unchanged — still gates by `profile.onboarded_at is null`. |
| `/dev/sign-in-as` | Unchanged. Stays as the local-dev fast path. Refuses to run unless `NODE_ENV=development`. |
| Session persistence | Bump Supabase project setting "JWT expiry" if it's not already at 1 hour (default) + refresh-token lifetime to 30 days (default is 1 week). |

### 2.2 Pages diagram (the auth navigation graph)

```
                                    ┌──────────────┐
                                    │  /signup     │ (new) email+password → signUp → /onboarding
                                    └──────┬───────┘
              first-time visitor──────────┘
                                                                      ┌──────────────────┐
              returning user ──────► /login ──signInWithPassword────► / (For You feed)   │
                                       │                              └──────────────────┘
                                       ├──"Forgot password?"──► /forgot-password
                                       │                              │  resetPasswordForEmail
                                       │                              ▼
                                       │                       (email arrives)
                                       │                              │
                                       │                              ▼
                                       │                       /auth/reset-password ──► /login
                                       │                              (updateUser password)
                                       │
                                       └──"Sign in with email code"──► (legacy OTP — unchanged)
```

### 2.3 What does NOT change

- **No backend / FastAPI changes** — Supabase handles password verification entirely. Our API still just verifies the JWT it receives, same as today.
- **No DB schema changes** — `profiles` table is unchanged. Supabase Auth's `auth.users` table grows a hashed password column (managed by Supabase, not us).
- **No new env vars** — everything runs through the existing Supabase project.

---

## 3. Implementation order

Sequential. Each step is independently testable.

### Step 1 — Configure Supabase Auth

In the Supabase dashboard:
- **Authentication → Providers → Email**: keep enabled, **uncheck "Confirm email"** (per decision 1.1).
- **Authentication → URL Configuration**: already done in Phase 12. Confirm Site URL and Redirect URLs include `https://zolalongform.com/**`.
- **Authentication → Email Templates**: customize the "Reset Password" template later if desired; default works.

No code changes yet.

### Step 2 — `/signup` page

- New route `apps/web/app/signup/page.tsx` (server component for the page shell).
- New client form `signup-form.tsx`:
  - Email input
  - Password input (with show/hide toggle)
  - Password strength meter using `zxcvbn-ts`
  - Submit calls `supabase.auth.signUp({ email, password })`
  - On success → router.push('/onboarding')
  - On error: surface message; common cases: "User already registered" (suggest sign-in), "Password too weak" (won't happen with our threshold)
- Link from `/login` page: "Need an account? Sign up"

### Step 3 — Update `/login` to use password

- Modify `login-form.tsx`:
  - Replace single-input OTP form with email + password form
  - Submit calls `supabase.auth.signInWithPassword({ email, password })`
  - On success → `router.push('/')` (middleware redirects to /onboarding if needed)
  - On error: "Invalid login credentials" → generic "Email or password is incorrect" (don't leak which is wrong, for enumeration resistance)
  - Add "Forgot password?" link → `/forgot-password`
  - Keep a small subtle link "Sign in with email code instead" that routes to the legacy OTP flow (move existing OTP code to `/login/otp` or a toggle within the same form)

### Step 4 — `/forgot-password` + `/auth/reset-password`

- New route `apps/web/app/forgot-password/page.tsx`:
  - Single email input
  - Submit calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: 'https://zolalongform.com/auth/reset-password' })`
  - Generic success message regardless of whether email exists (don't leak account enumeration)
- New route `apps/web/app/auth/reset-password/page.tsx`:
  - Reads the access_token from URL fragment (Supabase recovery email lands here with `#access_token=...&type=recovery`)
  - Calls `supabase.auth.setSession()` with that token
  - New password + confirm password form
  - Submit calls `supabase.auth.updateUser({ password })`
  - On success → `router.push('/login')` with a flash "Password updated, please sign in."

### Step 5 — "Change password" in `/settings`

- Add a `<ChangePasswordForm>` client component
- Three fields: current password, new password, confirm
- Submit:
  1. Call `signInWithPassword({email: currentUser.email, password: currentPassword})` to verify the current password (Supabase doesn't expose a "verify password without changing session" endpoint, but a successful sign-in is effectively the same)
  2. Then call `supabase.auth.updateUser({ password: newPassword })`
- Show success / error inline. Use the toast system from Phase 10.

### Step 6 — Documentation pass

- Update `PHASE_11_AUTH.md` with implementation notes / surprises (this file becomes the historical record once shipped)
- Update `PROGRESS.md` with the Phase 11 entry
- Update `ROADMAP.md` to mark Phase 11 done; flag Phase 11.5 (OAuth) as a follow-up if not bundled

### Step 7 — Smoke test on production

- Signup with a fresh email → onboarding → save an article → sign out
- Sign back in with the same email + password
- Trigger forgot-password → click email link → set new password → sign in with new
- Change password from settings
- Verify the legacy OTP fallback still works (one test)

---

## 4. Edge cases & error handling

| Case | Behavior |
|---|---|
| User already exists (signup) | Surface "An account with this email already exists. [Sign in instead](/login)." |
| Wrong password | "Email or password is incorrect." (do not differentiate from "user not found" — enumeration resistance) |
| Password reset email never arrives | User clicks "Forgot password" again. We don't say whether the previous attempt succeeded — same anti-enumeration logic. |
| User changes email | Out of scope for Phase 11. (Supabase supports this via `updateUser({email})` but the verification flow has its own complexities.) |
| User has a pre-existing account from OTP signup | Their `auth.users` row has no password set. First time they try password sign-in they'll get "Invalid login credentials". They should use the "Forgot password" flow to set one. **Document this prominently in the launch comms.** |
| Session expires mid-session | `next-themes`-aware middleware refreshes the token transparently via Supabase SSR. No user-facing change. |
| Rate limiting | Supabase's built-in rate limiter handles brute-force on `/auth/v1/token` — no need to add our own initially. Revisit if you see abuse. |

---

## 5. Open question: existing accounts

You have at least one account (`pvlellouche@gmail.com`) that signed up via OTP. After Phase 11 ships:
- That account has no password set.
- Trying to sign in with email + password will return "Invalid login credentials."
- The fix is the "Forgot password" flow — it sends a recovery email, user sets a password, done.

**Action item before launch**: send yourself / any other OTP-era account a heads-up + explicit "use Forgot password to set your password" instruction.

For a public launch later, we'd want a one-time prompt on the legacy `/login` flow: "We've added password sign-in. Reset your password to use it." — but that's polish, not blocker.

---

## 6. What's NOT in this phase (deferred)

- **OAuth providers** (Google, GitHub) → Phase 11.5
- **Two-factor auth** → not on the roadmap
- **Account deletion / data export** → eventually GDPR-relevant; deferred until first user request
- **Email change flow** (user wants to update their email address) → deferred; Supabase supports it but the verification UX needs work
- **Username uniqueness conflicts at signup** → unchanged — username is picked at `/onboarding`, not `/signup`, so this is orthogonal to Phase 11
- **CAPTCHA on signup** → if signup abuse appears, add hCaptcha (Supabase has built-in support). Not before.
- **Audit log of sign-in attempts** → defer until you actually need it. Supabase keeps some of this server-side already.

---

## 7. Estimate

- Steps 1–7 above: **~1 full day of focused work**. The 3 new pages are nearly identical to existing forms (sign-in, settings); the harder part is the password-reset round-trip and edge-case copy.
- Plus a 1–2 hour test pass to verify all flows on prod after deploy.

---

## 8. Files I expect to touch

```
apps/web/
├── app/
│   ├── signup/page.tsx                   (NEW)
│   ├── signup/signup-form.tsx            (NEW)
│   ├── forgot-password/page.tsx          (NEW)
│   ├── forgot-password/form.tsx          (NEW)
│   ├── auth/reset-password/page.tsx      (NEW)
│   ├── auth/reset-password/form.tsx      (NEW)
│   ├── login/page.tsx                    (slim wrapper — unchanged)
│   ├── login/login-form.tsx              (REWRITTEN: password instead of OTP, keep OTP as fallback link)
│   └── settings/
│       └── change-password-form.tsx      (NEW; mounted on the existing settings page)
├── components/
│   └── auth-fragment-handler.tsx         (small adjustment to also handle `type=recovery` fragments)
└── lib/
    └── auth.ts                           (probably no change; requireUser stays)

services/api/                              (no changes — backend doesn't care about how the JWT was obtained)
```

Plus a small dependency add: `@zxcvbn-ts/core` + `@zxcvbn-ts/language-common` + `@zxcvbn-ts/language-en` (~25 KB total).

---

*Pending decisions in §1 before implementation starts. Reply with picks and I'll begin Step 1.*
