# Zola — Deployment Runbook

> Operational reference for deploying and re-deploying Zola to production. Pairs with `ROADMAP.md` (strategy) and `PROGRESS.md` (history). When operations change, update this file.

## ⚠️ Carry-forward TODOs (deferred during Phase 12)

These are intentionally-deferred items that will eventually need to happen. Marked here at the top of the doc so they don't get lost in the bigger sections below.

- **Vercel Preview env vars** — not set. Means PR-preview deploys build but break at runtime. Re-enable when adopting a PR-based workflow. See [§ Pull-request previews](#pull-request-previews-deferred--re-enable-later) for the exact 3-step recipe.
- **Render free → Starter ($7/mo)** — switch when the keep-awake hack becomes insufficient or the first user complains about cold-start latency. The keep-Render-awake GH workflow becomes redundant on Starter — delete it then.
- **Separate Supabase project for previews** — if PR previews matter, you'll want one. Production and preview currently share a database, so risky PR work could corrupt prod data.
- **Custom Supabase email provider** — Supabase free-tier email is heavily rate-limited (current sign-in OTP issue). Once Phase 11 moves us to password auth this matters less, but if you keep email-based flows, hook up a Resend/Postmark sender via Supabase Auth settings → SMTP.
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

- **Vercel** hosts the Next.js app (`apps/web`). Auto-deploys on push to `main`.
- **Render** (planned, not yet set up) will host the FastAPI app (`services/api`).
- **Supabase** is the source of truth for Postgres data, Auth, and Storage (avatars).
- **GitHub Actions** runs the RSS ingestion cron and writes directly to Supabase.

## Current production state

| Component | Status | URL / Reference |
|---|---|---|
| Frontend (Vercel) | ✅ deployed | `https://zolalongform.com` |
| Custom domain | ✅ live on GoDaddy DNS | `zolalongform.com` (apex A + www CNAME → Vercel) |
| SSL cert | ✅ issued | Let's Encrypt, auto-renewed by Vercel |
| Backend (Render) | ❌ not yet deployed | planned at `api.zolalongform.com` |
| Supabase Auth — Site URL | ⚠️ still `localhost` | needs update to `https://zolalongform.com` |
| Supabase Auth — Redirect URLs | ⚠️ still `localhost` | add `https://zolalongform.com/**` |
| FastAPI CORS `allow_origins` | ⚠️ still `["http://localhost:3000"]` | needs `https://zolalongform.com` before Render deploy |
| `NEXT_PUBLIC_API_URL` (Vercel) | ⚠️ placeholder | swap to `https://api.zolalongform.com` once Render is live |
| Vercel Preview env vars | ❌ not set | PR previews will fail until added via dashboard |

## Vercel project facts

- **Org**: `paullellouche` (Hobby tier)
- **Project**: `zola` (id `prj_oBr0mniHQuqUbW1Wm1yiW4jbSpBu`)
- **Root Directory**: `apps/web`
- **Framework**: Next.js (auto-detected; Vercel walks up to install the pnpm workspace from the repo root)
- **Build / install / output**: all defaults — no `vercel.json` in the repo
- **Local link**: `.vercel/project.json` at the repo root (gitignored)

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

`git push origin main` also triggers a production deploy via the GitHub integration. Use the CLI when you want to deploy a working-copy snapshot without committing.

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

## Remaining work to finish Phase 12

In order. Each step assumes the previous one succeeded.

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

- **Vercel CLI v54 + Preview env vars**: `vercel env add NAME preview --yes` requires a TTY for the "which git branch?" prompt even when `--yes` is passed. The non-interactive form errors with `git_branch_required`. Workaround: use the dashboard for preview env vars.
- **Monorepo with `apps/web` Root Directory**: Vercel needs to find Next.js in the deploy directory's `package.json`. Setting Root Directory to the repo root fails with "No Next.js version detected." Correct config is Root Directory = `apps/web`, and Vercel auto-detects the pnpm workspace from the repo root because of `pnpm-workspace.yaml`.
- **`dotenv-cli` in build scripts**: the `apps/web/package.json` build script (`dotenv -e ../../.env -- next build`) doesn't work on Vercel because the `.env` file isn't there. Vercel auto-detection bypasses this by running `next build` directly. If you ever need to override Build Command, it's just `next build` (no dotenv wrapper).
- **Env-var changes don't trigger redeploys**: must explicitly `npx vercel --prod --yes` (or push a new commit).

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

**Current state**: every PR builds, but the build will fail at runtime because the **Preview** environment is missing all three `NEXT_PUBLIC_*` env vars. We deliberately deferred this — the Vercel CLI v54 has a bug that blocks adding Preview env vars non-interactively (see the gotchas section). Production-only deploys work fine via `git push origin main`.

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
- Until re-enabled, **don't open PRs you intend to test from a Vercel preview** — they'll build but the runtime will throw on missing env vars. Push directly to `main` for now.
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

*Last updated: 2026-05-23, immediately after first Vercel deploy.*
