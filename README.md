# Zola

A discovery surface for long-form essays, reporting, and criticism. The user-facing app is "Zola"; the repository folder and package names remain `longform`/`@longform/*` (codebase rename is a separate, larger refactor — see `ROADMAP.md`).

See `COMMAND_CENTER.md` for the architecture and `DESIGN.md` for the visual identity.

## Quickstart (local dev)

```bash
# 1. Install JS deps
pnpm install

# 2. Set up Python venv for the API (needs Python 3.12; install via Homebrew: `brew install python@3.12`)
cd services/api
/usr/local/bin/python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ../..

# 3. Copy .env.example → .env and fill in Supabase credentials
cp .env.example .env

# 4. Run frontend (Next.js) on http://localhost:3000
pnpm dev

# 5. Run backend (FastAPI) on http://localhost:8000 in another terminal
pnpm dev:api
```

Health check: `curl http://localhost:8000/healthz`

## Docs
- `ROADMAP.md` — phases (status + scope) + pending small follow-ups
- `PROGRESS.md` — backward-looking ledger of what shipped in each phase
- `COMMAND_CENTER.md` — architecture, data model, decision log, anti-features
- `DEPLOYMENT.md` — production runbook (Vercel + Render + Supabase + Sentry + Resend)
- `DESIGN.md` — visual identity, typography, color tokens
- `Longform_Reading_MVP_Scaffolding.md` — original scaffolding notes + seed source list

## Current shape (2026-06-04)
- **46 active sources, ~3,500 articles**, embedded by GHA cron (sentence-transformers/all-MiniLM-L6-v2).
- **End-to-end live** on `zolalongform.com` (Next 15 on Vercel) + `api.zolalongform.com` (FastAPI on Render).
- **Phases 11/12/13 ✅**, Phase 17 light ✅ (Sentry + admin dashboard + opt-in user directory), Phase 18 first slice ✅ (embeddings, semantic search behind a flag).
- **Off-roadmap shipped**: ratings + Elo + pairwise comparisons, hours leaderboard, flat comments, mixed-source browse default, paywall chips, hand-rendered favicon.

See `ROADMAP.md` for what's next.
