# Zola — Deployment Runbook

> Operational reference for deploying and re-deploying Zola to production. Pairs with `ROADMAP.md` (strategy) and `PROGRESS.md` (history). When operations change, update this file.

## ⚠️ Carry-forward TODOs (deferred but live to remember)

These are intentionally-deferred items that will eventually need to happen. Marked here at the top of the doc so they don't get lost in the bigger sections below.

- **Vercel GitHub auto-deploy is NOT connected.** We created the Vercel project via `vercel link` from the CLI — that flow does not auto-wire the GitHub integration. Pushes to `main` do not trigger deploys; every deploy currently requires `cd "/Users/paul/Documents/Long Form Reading App" && npx vercel --prod --yes`. One-time fix: Vercel dashboard → project `zola` → Settings → Git → "Connect Git Repository" → pick `plellouche/Zola-Long-Form-Reading`. Skipped for now because manual deploys are working fine and the change has its own small risk of misconfiguration.
- **Vercel Preview env vars** — not set. Means PR-preview deploys build but break at runtime. Re-enable when adopting a PR-based workflow. See [§ Pull-request previews](#pull-request-previews-deferred--re-enable-later) for the exact 3-step recipe.
- **Render free → Starter ($7/mo)** — switch when the keep-awake hack becomes insufficient or the first user complains about cold-start latency. The keep-Render-awake GH workflow becomes redundant on Starter — delete it then.
- **Separate Supabase project for previews** — if PR previews matter, you'll want one. Production and preview currently share a database, so risky PR work could corrupt prod data.
- **Sentry / error tracking** — Phase 17 territory; trigger is the first real user-visible error you didn't catch in logs.

## Topology

```
                  ┌────────────────────────────────────────┐
                  │             Supabase                   │
   user ──HTTPS──▶│   Postgres · Auth · Storage · RLS      │
                  └────────────────────────────────────────┘
                           ▲                ▲
                           │                │
                  ┌────────┴───┐    ┌───────┴────────┐
                  │   Vercel   │    │    Render      │
                  │  Next.js   │──▶ │   FastAPI      │
                  │ (frontend) │    │  (backend API) │
                  └────────────┘    └────────────────┘
                           ▲
                           │
                   GitHub Actions
                  (ingestion cron)
```

- **Vercel** hosts the Next.js app (`apps/web`). Manual deploys via `npx vercel --prod --yes` from the repo root — see the Carry-forward TODOs note above about reconnecting GitHub auto-deploy.
- **Render** hosts the FastAPI app (`services/api`) at `api.zolalongform.com`. Auto-deploys on push to `main` (the Render blueprint at the repo root has `autoDeploy: true`).
- **Supabase** is the source of truth for Postgres data, Auth, and Storage (avatars). Auth emails are sent via Resend custom SMTP — see "Email delivery via Resend" below.
- **GitHub Actions** runs the RSS ingestion cron and writes directly to Supabase. A second workflow pings the Render API every 10 minutes to keep the free tier awake.

## Current production state

| Component | Status | URL / Reference |
|---|---|---|
| Frontend (Vercel) | ✅ live | `https://zolalongform.com` |
| Backend (Render) | ✅ live | `https://api.zolalongform.com` (Render free tier; kept warm by GH Actions workflow) |
| Custom domains | ✅ live on GoDaddy DNS | Apex A + `www` CNAME → Vercel; `api` CNAME → Render |
| SSL certs | ✅ issued | Let's Encrypt on Vercel (apex) and Render (api subdomain) |
| Supabase Auth — Site URL | ✅ | `https://zolalongform.com` |
| Supabase Auth — Redirect URLs | ✅ | `https://zolalongform.com/**`, `https://zolalongform.com/auth/callback` |
| FastAPI CORS `allow_origins` | ✅ | includes `https://zolalongform.com`, `https://www.zolalongform.com`, the Vercel alias, and a regex for preview deploys |
| `NEXT_PUBLIC_API_URL` (Vercel) | ✅ | `https://api.zolalongform.com` |
| Email delivery (Resend custom SMTP) | ✅ live | from `noreply@zolalongform.com` (sender name "Zola Longform"); domain verified — see "Email delivery via Resend" below |
| Keep-Render-awake GH Action | ✅ running | pings `/healthz` every 10 min via `RENDER_API_URL` secret |
| Vercel GitHub auto-deploy | ❌ NOT connected | manual `npx vercel --prod --yes` required; see Carry-forward TODOs |
| Vercel Preview env vars | ❌ not set | PR previews build but break at runtime; see "Pull-request previews" below |

## Vercel project facts

- **Org**: `paullellouche` (Hobby tier)
- **Project**: `zola` (id `prj_oBr0mniHQuqUbW1Wm1yiW4jbSpBu`)
- **Root Directory**: `apps/web`
- **Framework**: Next.js (auto-detected; Vercel walks up to install the pnpm workspace from the repo root)
- **Build / install / output**: all defaults — no `vercel.json` in the repo
- **Local link**: `.vercel/project.json` at the repo root (gitignored)

## Email delivery via Resend

All Supabase Auth emails (sign-up confirmation, password reset, magic-link OTP fallback) ship via a Resend SMTP integration. Replaces Supabase's built-in sender, which is heavily rate-limited and tends to land in spam.

| Setting | Value |
|---|---|
| Resend account owner | `pllch@umich.edu` |
| Verified domain | `zolalongform.com` (US-East region) at https://resend.com/domains |
| DNS records | DKIM (`resend._domainkey`), MX (`send`), SPF (`send v=spf1 …`) — added at GoDaddy via Resend's Auto-Configure |
| Supabase SMTP host | `smtp.resend.com` |
| Port | `465` (SMTPS) |
| Username | `resend` |
| Password | Resend API key (`re_…`) — never stored in repo; lives only in Supabase project settings |
| Sender email | `noreply@zolalongform.com` |
| Sender name | `Zola Longform` |
| Minimum interval per user | 60s (Supabase setting; rate-limits per-recipient at the Supabase layer before the email hits Resend) |
| Free-tier limits | Resend 100 emails/day — plenty for invite-only |

### What to update if you change domain or rotate the API key

1. Re-verify domain at https://resend.com/domains.
2. Generate a new API key in Resend → Settings → API Keys.
3. Update Supabase Auth → Emails → SMTP password field with the new key.
4. Send a test (`/forgot-password` on prod) to confirm delivery.

### What to do if email delivery breaks

1. Check Supabase Auth logs: https://supabase.com/dashboard/project/rkyephzcumidqnhqmhfw/logs/auth-logs — filter for "Error sending recovery email". The error text is verbose and usually names the root cause (DNS, rate limit, sandbox mode, etc.).
2. Check Resend logs: https://resend.com/logs — every send attempt shows up, with delivery status.
3. Common causes seen so far: Resend left in sandbox mode (only owner email gets delivered — fix by verifying domain), domain DKIM record missing or rotated (fix by re-verifying at Resend), Supabase rate limit hit (~3 reset emails/hour per user on free tier).

## Frequent operations

### Trigger a deploy from the CLI

Always run from the repo root (the linked directory):

```bash
cd "/Users/paul/Documents/Long Form Reading App"

# Production
npx vercel --prod --yes

# Preview (current branch)
npx vercel --yes
```

**Pushes to `main` do NOT auto-deploy to Vercel** — the GitHub integration was never connected (see Carry-forward TODOs at the top). Render auto-deploys on push, but Vercel needs the manual `npx vercel --prod --yes` command above each time. To restore the expected push-to-deploy behavior, go to Vercel → Settings → Git → Connect Git Repository.

### Inspect a deploy

```bash
npx vercel inspect <deployment-url>            # status + metadata
npx vercel inspect <deployment-url> --logs     # build logs
npx vercel ls                                  # recent deployments
```

### Promote a preview to production

```bash
npx vercel promote <deployment-url>
```

### Manage env vars

> **Never echo secret values in your terminal — pipe from `.env` or use `--value`.**

List:
```bash
npx vercel env ls                  # production by default
npx vercel env ls preview          # preview-targeted vars (currently empty)
npx vercel env ls development      # local-dev-only vars (currently empty)
```

Add (production):
```bash
# Workaround for v54's non-interactive quirks: pipe value from .env, use --yes
printf "%s" "$(grep -E '^NEXT_PUBLIC_API_URL=' .env | cut -d= -f2-)" \
  | npx vercel env add NEXT_PUBLIC_API_URL production --yes
```

Add (preview): **does not work non-interactively in CLI v54.** Use the dashboard:
`https://vercel.com/paullellouche/zola/settings/environment-variables` → Add → check "Preview".

Remove:
```bash
npx vercel env rm NEXT_PUBLIC_API_URL production --yes
```

After changing env vars you must **redeploy** — Vercel does not auto-rebuild on env changes:
```bash
npx vercel --prod --yes
```

### Pull production env vars to a local file

Useful for debugging "works on my machine vs Vercel":
```bash
npx vercel env pull .env.production.local --environment=production --yes
```

`.env.production.local` is already gitignored by Next.js conventions.

## Phase 12 setup steps (historical reference — all complete)

> Kept as documentation for what was actually done, in case any of it needs to be redone (rotating credentials, re-creating a service, etc.). All steps below are shipped — see the "Current production state" table above.

### 1. Add CORS for the Vercel URL

Edit `services/api/app/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://zolalongform.com",
        # add custom domain here when ready
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Commit and push so Render picks it up on first deploy.

### 2. Deploy FastAPI to Render

Two paths:

**A. Native Python service** (simpler):
- Add a `services/api/render.yaml` or configure via dashboard:
  - Build command: `pip install -r requirements.txt`
  - Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
  - Root directory: `services/api`
  - Health check path: `/healthz`
  - Auto-deploy from `main`
- Add env vars in Render dashboard:
  - `SUPABASE_URL` (same as `NEXT_PUBLIC_SUPABASE_URL`)
  - `SUPABASE_SERVICE_ROLE_KEY` (from local `.env`)
  - `SUPABASE_JWT_SECRET` (optional — only used for legacy HS256 tokens)
  - `DATABASE_URL` (the Supabase asyncpg URL)
  - `RESEND_API_KEY` (only if admin invites are needed in prod)

**B. Dockerfile** (more control, slightly more work):
- Write `services/api/Dockerfile` based on `python:3.12-slim`.
- Same env vars.
- Render auto-detects the Dockerfile.

Pick the free tier first ($0 / sleeps after 15 min idle) to validate. Upgrade to Starter ($7/mo always-on) once you have invitees.

### 3. Point Vercel at Render

After Render gives you a URL like `https://zola-api.onrender.com`:

```bash
cd "/Users/paul/Documents/Long Form Reading App"
npx vercel env rm NEXT_PUBLIC_API_URL production --yes
printf "%s" "https://zola-api.onrender.com" \
  | npx vercel env add NEXT_PUBLIC_API_URL production --yes
npx vercel --prod --yes
```

### 3b. Wire the keep-awake workflow

We ship on Render Free, which sleeps after 15 min idle. To avoid the 30–60 s cold-start hit, a `.github/workflows/keep-render-awake.yml` workflow pings `/healthz` every 10 minutes. To activate it:

1. **Set the GitHub secret**:
   - Repo → Settings → Secrets and variables → Actions → New repository secret
   - Name: `RENDER_API_URL`
   - Value: `https://zola-api.onrender.com` (or whatever Render gave you)
2. **Trigger a test run**: Actions → "Keep Render awake" → Run workflow → main. Should return HTTP 200 in <2s once the service is warm.
3. From then on it runs every 10 minutes automatically. GitHub may occasionally skip a run during high load — the 10-min interval gives a safety buffer before Render's 15-min sleep threshold.

When you upgrade Render to Starter ($7/mo always-on), **delete this workflow** — it becomes pointless overhead.

### 4. Update Supabase Auth

Dashboard → Authentication → URL Configuration:
- **Site URL**: `https://zolalongform.com`
- **Redirect URLs**: add both
  - `https://zolalongform.com/**`
  - `https://zolalongform.com/auth/callback`

Without this, magic-link / OTP / password-reset emails route users back to `localhost:3000` and the auth flow silently breaks.

### 5. End-to-end smoke test

Use a fresh browser profile / incognito window:

1. Open `https://zolalongform.com`.
2. Sign in via OTP. Confirm the email arrives and the code works.
3. Walk through onboarding (username + topics).
4. Save an article from `/browse`.
5. Open `/discover`, swipe through 5 cards.
6. Create a list, add an article.
7. Follow a source.
8. Open `/u/<username>` and verify avatar / counts.

If any step fails, check the browser network tab for the failing request and `npx vercel logs` for the function output.

### 6. (Later) Custom domain

Once you've bought a domain (`zola.app`, etc.):

**Vercel side**:
- Project → Settings → Domains → Add → enter the domain.
- Add the suggested DNS records at your registrar.
- Vercel auto-issues an SSL cert.

**Render side**:
- Service → Settings → Custom Domain → add `api.zola.app`.
- Add the suggested CNAME record at your registrar.

**Update referenced URLs everywhere**:
- Supabase Site URL + Redirect URLs
- FastAPI `allow_origins`
- Vercel `NEXT_PUBLIC_API_URL` (point at the new Render subdomain)
- README / OG metadata if hardcoded anywhere

## Known gotchas (encountered, documented for next time)

- **Vercel GitHub auto-deploy is NOT connected.** Pushes to `main` do not trigger Vercel deploys — every deploy needs `npx vercel --prod --yes`. The CLI-based `vercel link` flow doesn't auto-wire the integration. One-time fix: Vercel dashboard → Settings → Git → Connect Git Repository.
- **Vercel CLI v54 + Preview env vars**: `vercel env add NAME preview --yes` requires a TTY for the "which git branch?" prompt even when `--yes` is passed. The non-interactive form errors with `git_branch_required`. Workaround: use the dashboard for preview env vars.
- **Monorepo with `apps/web` Root Directory**: Vercel needs to find Next.js in the deploy directory's `package.json`. Setting Root Directory to the repo root fails with "No Next.js version detected." Correct config is Root Directory = `apps/web`, and Vercel auto-detects the pnpm workspace from the repo root because of `pnpm-workspace.yaml`.
- **`dotenv-cli` in build scripts**: the `apps/web/package.json` build script (`dotenv -e ../../.env -- next build`) doesn't work on Vercel because the `.env` file isn't there. Vercel auto-detection bypasses this by running `next build` directly. If you ever need to override Build Command, it's just `next build` (no dotenv wrapper).
- **Env-var changes don't trigger redeploys**: must explicitly `npx vercel --prod --yes` (or push a new commit).
- **Supabase pooler URL needed on Render (IPv6 trap)**: Supabase's direct database URL (`db.<ref>.supabase.co:5432`) is IPv6-only as of 2024; Render's outbound is IPv4-only on most plans, so the API can't reach the DB through the direct URL. Use the **Session pooler** URL instead (`aws-1-us-east-2.pooler.supabase.com:5432`, format `postgresql+asyncpg://postgres.<ref>:<password>@…`). Transaction pooler (port 6543) does NOT work — it lacks prepared statements which SQLAlchemy + asyncpg requires.
- **Password-reset link prefetch (Proofpoint, Defender, Mimecast)**: corporate / university email scanners prefetch every URL in inbound mail to scan for phishing. They consume one-time-use Supabase PKCE recovery tokens before the user can click, so the reset flow dies with "invalid or expired".
  - **Workaround currently in place**: `apps/web/middleware.ts` catches `/?code=<uuid>` at the apex and forwards to `/auth/callback?next=/auth/reset-password`. The reset-password page handles the post-callback session correctly. **Don't delete this middleware code thinking it's dead** — it's load-bearing for UMich / corporate users.
  - **Better long-term fix**: render `{{ .Token }}` (a 6-digit code) instead of `{{ .ConfirmationURL }}` in the Supabase Reset Password template, so the email contains no clickable link at all. Our `/forgot-password` page already supports the code-paste path. Not adopted yet because the link-click UX is more familiar for most users.

## Cost expectations

At MVP scale (≤ 100 active users):
- **Vercel Hobby**: $0
- **Render Free**: $0 (sleeps; 30s wake-up on first request)
- **Supabase Free**: $0
- **GitHub Actions**: $0 (well under free-tier minutes)
- **Domain**: $10–15/yr

**Total ≈ $0–15/yr** until growth or commercial use forces an upgrade. See `ROADMAP.md` Phase 17 for the scaling triggers.

## Rollback

If a deploy breaks production:

```bash
# Find the previous good deploy
npx vercel ls

# Promote it back
npx vercel promote <previous-deployment-url>
```

Or use the dashboard: Deployments → click the previous good one → "Promote to Production".

For Render, redeploy a previous commit by clicking through the dashboard's deploy history.

## Pull-request previews (DEFERRED — re-enable later)

**Current state**: PR builds would fail at runtime because the **Preview** environment is missing all three `NEXT_PUBLIC_*` env vars. We deliberately deferred this — the Vercel CLI v54 has a bug that blocks adding Preview env vars non-interactively (see the gotchas section). Note also that the Vercel GitHub integration is not connected (separate carry-forward TODO), so PR pushes don't even trigger preview builds today.

### When to re-enable
- You start using a feature-branch workflow with PRs (instead of pushing straight to `main`)
- You want a teammate or reviewer to see changes on a Vercel-hosted URL before merge
- You want to test a risky change against production data without affecting `main`

### How to re-enable (10 minutes, dashboard-only)
1. **Vercel dashboard** → project `zola` → Settings → Environment Variables: https://vercel.com/paullellouche/zola/settings/environment-variables
2. For each of these three keys, **add a new entry targeting "Preview"** (production entries already exist — don't touch those):
   | Key | Value (same as production) |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://rkyephzcumidqnhqmhfw.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (the anon key from local `.env`) |
   | `NEXT_PUBLIC_API_URL` | `https://api.zolalongform.com` |
3. Save. The next PR push will get a working preview deploy with a URL posted as a comment.
4. (Optional, recommended later) For real isolation, create a **separate Supabase project** for previews so PR experimentation can't corrupt production data. Then point the Preview `NEXT_PUBLIC_SUPABASE_URL` at that staging project instead.

### Implications
- Until re-enabled, **don't open PRs expecting a Vercel preview** — they won't even build (no GitHub auto-deploy), and even if they did, the runtime would throw on missing env vars. For now, push to `main` then `npx vercel --prod --yes`.
- The keep-Render-awake workflow doesn't care about previews; it only pings the production API.

## Future: switch to Pro

Trigger to upgrade Vercel from Hobby to Pro ($20/mo per user):
- Any monetization (paid tier, ads, affiliate links). Vercel TOS prohibits commercial use on Hobby.
- Need for password-protected previews.
- More than one collaborator on the project.

Trigger to upgrade Render from Free to Starter ($7/mo):
- First user complains about the 30s cold start.
- Production traffic justifies the cost.

---

*Last updated: 2026-05-24, after Phase 11 + Phase 12 close-out (Render live, Resend SMTP configured, end-to-end auth verified on production).*
