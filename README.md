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
- `COMMAND_CENTER.md` — architecture, data model, phased plan, decision log
- `PROGRESS.md` — live build state (update as you go)
- `Longform_Reading_MVP_Scaffolding.md` — original scaffolding notes + seed source list
