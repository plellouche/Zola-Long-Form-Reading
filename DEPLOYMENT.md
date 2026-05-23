# Zola — Deployment Runbook

> Operational reference for deploying and re-deploying Zola to production. Pairs with `ROADMAP.md` (strategy) and `PROGRESS.md` (history). When operations change, update this file.

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

## Pull-request previews (when enabled)

Currently disabled because we never added env vars to the Preview environment. When you want PR previews:

1. Dashboard → Settings → Environment Variables → add the three `NEXT_PUBLIC_*` vars to Preview as well.
2. Push a PR. Vercel will auto-create a preview deploy and post the URL as a PR comment.
3. The preview will share the production Supabase project (same DB, same Auth) — so test with care. For full isolation, set up a separate Supabase project for preview and use a different `NEXT_PUBLIC_SUPABASE_URL`.

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
