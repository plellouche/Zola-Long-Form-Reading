# Build Progress

> Live state of the implementation. Update after each meaningful step so we can resume cleanly across sessions or rate-limit interruptions.

## Conventions
- Source of truth for design = `COMMAND_CENTER.md`.
- This file is a **state log**, not a redesign space. If something contradicts COMMAND_CENTER, fix the doc first.
- Each phase has: status, completed items (checked), open items (unchecked), and notes.

---

## Environment

| Tool | Required | Installed | Notes |
|---|---|---|---|
| Node | >=20 | 20.15.1 | Intel macOS (darwin-x64) |
| Python | 3.12 preferred | 3.11.1 | 3.11 is fine for FastAPI/SQLAlchemy 2.0; not blocking |
| pnpm | 9+ | 9.15.0 | Installed via `COREPACK_INTEGRITY_KEYS=0 corepack prepare pnpm@9.15.0 --activate` (corepack signing-key bundle in Node 20.15 is stale; standalone installer rejects Intel macOS; Homebrew available as fallback) |
| Homebrew | — | 5.1.3 | Fallback for pnpm/python upgrades if needed |

---

## Phase 0 — Foundation & Scaffolding

**Status**: in progress

### Completed
- [x] Environment verification (Node 20, Python 3.11, pnpm 9.15)

### Open
- [ ] Root monorepo files (`pnpm-workspace.yaml`, root `package.json`, `.gitignore`, `.env`, `.env.example`, `.nvmrc`, `.python-version`)
- [ ] `apps/web` — Next.js 15 + TS + Tailwind + shadcn/ui + Supabase client
- [ ] `packages/shared` — TS types
- [ ] `packages/api-client` — typed fetch wrapper
- [ ] `services/api` — FastAPI + JWT auth + SQLAlchemy 2.0 async + Alembic
- [ ] `packages/ingest` — Python stub
- [ ] `packages/recs` — Python stub
- [ ] `infra/supabase` — empty folder structure
- [ ] Local dev verification (web boots, API `/healthz` returns 200)
- [ ] `git init` + first commit (no remote yet)

### Deferred to later phases (intentionally)
- Vercel / Render deploys → after Phase 0 is verified locally
- GitHub Actions CI → after `git init`
- DB migrations → Phase 1 (auth) + Phase 2 (core data model)
- Seed data + source triage from scaffolding doc section 13 → Phase 2

---

## Phase 1+ — Not Started

See `COMMAND_CENTER.md` §12 for scope.

---

## Decisions made during Phase 0

| Topic | Decision | Why |
|---|---|---|
| Cron host | GitHub Actions | `packages/ingest` is Python; pg_cron would have to call out to HTTP anyway |
| Admin role | `profiles.role TEXT DEFAULT 'user'` column | Cleaner than env list; scales |
| User topic interests | New `user_topics(user_id, topic_id, weight)` table | COMMAND_CENTER originally said `user_article_states` which is the wrong table |
| Onboarding | Force username + topic selection before profile is usable | Avoids placeholder usernames in `/u/[username]` URLs |
| Python version | 3.11 (installed) instead of 3.12 (doc) | No functional difference for our stack; revisit if a dep requires 3.12 |
| pnpm install method | corepack with `COREPACK_INTEGRITY_KEYS=0`, pinned 9.15.0 | Standalone installer broken on Intel macOS; global npm install needs sudo |

---

## Open security / hygiene items
- [ ] Rotate Supabase DB password (currently in `Longform_Reading_MVP_Scaffolding.md` §14 — plaintext in chat history)
- [ ] Confirm `.env` is gitignored before any commit
- [ ] `.env.example` only contains placeholders, never real values

---

## How to resume after an interruption

1. Read this file top-to-bottom.
2. Read `TaskList` output for the live task state (if same session) or run `git log --oneline -20` (if cross-session).
3. Continue from the first unchecked item in the current Phase block.
4. Update this file as you complete items.
