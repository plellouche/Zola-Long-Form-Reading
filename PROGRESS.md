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
| Python | 3.12 preferred | 3.12.13 (Homebrew) | Installed during Phase 0 via `brew install python@3.12`. Earlier system 3.11 ran but pyenv pin failed |
| pnpm | 9+ | 9.15.0 | Installed via `COREPACK_INTEGRITY_KEYS=0 corepack prepare pnpm@9.15.0 --activate` (corepack signing-key bundle in Node 20.15 is stale; standalone installer rejects Intel macOS; Homebrew available as fallback) |
| Homebrew | — | 5.1.3 | Fallback for pnpm/python upgrades if needed |

---

## Phase 0 — Foundation & Scaffolding

**Status**: complete (commit `03842b6`)

### Completed
- [x] Environment verification (Node 20.15, Python 3.12.13 via Homebrew, pnpm 9.15)
- [x] Root monorepo files (`pnpm-workspace.yaml`, root `package.json`, `.gitignore`, `.env`, `.env.example`, `.nvmrc`, `.python-version`, `README.md`)
- [x] `apps/web` — Next.js 15.1 + React 19 + TS + Tailwind 3.4 + Supabase SSR client
- [x] `packages/shared` — TS types (User, Source, Topic, Article, List, Event)
- [x] `packages/api-client` — typed fetch wrapper with bearer-token injection
- [x] `services/api` — FastAPI + SQLAlchemy 2.0 async + Alembic (async-compatible env.py) + Supabase JWT verification
- [x] `packages/ingest` — Python pyproject.toml stub (deps: feedparser, httpx, bs4, dateutil)
- [x] `packages/recs` — Python pyproject.toml stub (deps: numpy, scikit-learn, pandas)
- [x] `infra/supabase` — empty folder structure (migrations/, policies/, seed/)
- [x] Local dev verification: `pnpm typecheck` clean across 3 TS packages, FastAPI `/healthz` → 200, Next.js `/` → 200
- [x] `git init` + first commit (no remote)

### Deferred to later phases (intentionally)
- Vercel / Render deploys → after Phase 1 is real
- GitHub Actions CI → after first push to remote
- DB migrations → Phase 1 (auth) + Phase 2 (core data model)
- Seed data + source triage from scaffolding doc section 13 → Phase 2
- `services/api` does not yet load `packages/ingest` or `packages/recs`. Add via `pip install -e ../../packages/ingest` (and same for recs) when those phases start.

---

## Phase 1 — Auth & User Profiles

**Status**: complete pending live magic-link smoke test by user

### Completed
- [x] SQL migration `infra/supabase/migrations/001_phase1_auth_profiles.sql`: `profiles`, `topics`, `user_topics`, `is_admin()` helper, `handle_new_auth_user` trigger, RLS policies, 12 seed topics
- [x] Migration applied to Supabase project (verified via `psql`)
- [x] SQLAlchemy models in `services/api/app/models/profile.py`
- [x] Pydantic schemas in `services/api/app/schemas/profile.py`
- [x] FastAPI endpoints: `GET /api/users/me`, `PATCH /api/users/me`, `POST /api/users/me/onboarding`, `GET /api/users/{username}`, `GET /api/topics`
- [x] Next.js Supabase auth: `middleware.ts` + `lib/supabase/middleware.ts` for session refresh
- [x] `lib/auth.ts` (`getUser`, `requireUser`, `getAccessToken`) and `lib/server-api.ts` (bearer-auth'd FastAPI client from RSC)
- [x] Pages: `/login` (magic link), `/auth/callback`, `/auth/signout`, `/onboarding`, `/u/[username]`, `/settings`, gated `/` home
- [x] dotenv-cli wired into `apps/web` scripts so Next.js reads the monorepo root `.env`
- [x] `next.config.mjs` `outputFileTracingRoot` set to silence Next's workspace-root warning
- [x] Smoke tests pass: 12 topics, /api/users/me → 401 unauth, /api/users/{nonexistent} → 404, /onboarding & /settings → 307 to /login when anon, /u/{nonexistent} → 404

### Pending live verification (requires user)
- [ ] Magic link end-to-end: submit email on `/login` → receive email → click link → onboarding completes → profile visible at `/u/{username}` → can edit at `/settings`

### Notable Phase 1 decisions
- Migrations for auth-adjacent tables (anything touching `auth.users`) live in `infra/supabase/migrations/` as raw SQL — Alembic stays for content tables (Phase 2+). Reason: Alembic can't naturally reference Supabase's `auth` schema.
- `profiles.username` is **nullable** until onboarding completes (`profiles.onboarded_at` is the canonical "is this user usable" flag). The home page redirects to `/onboarding` if `onboarded_at IS NULL`.
- The FastAPI process uses the **postgres superuser** connection (`DATABASE_URL`), which bypasses RLS. Auth enforcement is done in FastAPI via JWT verification. RLS exists as a defense-in-depth layer for any future direct-from-browser Supabase access.
- `.env` `DATABASE_URL` password was URL-encoded (`$` → `%24`) — bash `source .env` was treating `$@` as positional-parameter expansion, eating the `@` between password and host. Asyncpg/SQLAlchemy decode the URL form correctly.
- `dotenv-cli` chosen over symlinking `apps/web/.env.local` → root `.env`. Symlinks are not portable; dotenv-cli is explicit and standard.
- **JWT verification supports both ES256/RS256 (via JWKS) and legacy HS256.** This Supabase project uses the new asymmetric-key signing system (kid `6d2b59d6-...`, alg `ES256`). The first implementation only tried HS256 and rejected every real token — fixed by `PyJWKClient` lookup against `https://<project>.supabase.co/auth/v1/.well-known/jwks.json`.

---

## Phase 2 — Core Data Model & Manual Article Entry

**Status**: complete

### Completed
- [x] SQL migration `002_phase2_content.sql`: `sources`, `articles`, `article_topics`, `events`, full-text search column (`search_tsv` GIN-indexed for Phase 4), RLS, indexes
- [x] Seed sources (29 entries) triaged from scaffolding doc §13 into 4 kinds: PUBLICATION, BLOG, DISCOVERY_SURFACE, PAYWALLED_FREE_SUBSET
- [x] Seed articles (`003_seed_articles.sql`): 12 articles across sources with 23 topic links
- [x] SQLAlchemy models for Source, Article, ArticleTopic, Event
- [x] Pydantic schemas: SourceCreate/Update/Out, ArticleCreate/Summary/Detail, EventCreate/Out
- [x] FastAPI endpoints:
  - `GET /api/sources`, `GET /api/sources/{slug}`, `POST /api/sources` (admin), `PATCH /api/sources/{id}` (admin)
  - `GET /api/articles` (filters: source_slug, topic_slug, limit, offset), `GET /api/articles/{id}`, `POST /api/articles` (admin)
  - `POST /api/events` (accepts anonymous; user_id derived from JWT when present)
- [x] Admin role bootstrap: on every `GET /api/users/me`, if user's email is in `ADMIN_BOOTSTRAP_EMAILS`, promote `profiles.role` to 'admin' once
- [x] `require_admin` FastAPI dependency for admin-only routes
- [x] Shared `<NavBar>` in root layout (auth-aware: shows login or username/admin/settings/signout)
- [x] `/browse` page — grid of `<ArticleCard>` with source + topic filters via querystring
- [x] `/article/[id]` page — detail view with `<ReadArticleButton>` that fires `LINK_CLICK` event then opens canonical URL in new tab
- [x] `/settings/sources` admin page — read-only table of all sources (edit lands later)
- [x] `/settings/articles/new` admin page — manual article entry form with topic multi-select
- [x] `lib/auth.ts` extended with `getProfile()` and `requireAdmin()` server helpers
- [x] Smoke tests: filter endpoints, anonymous events, admin gate, all routes return expected status codes (200/307/401/404)

### Notable Phase 2 decisions
- **Raw SQL migrations** (not Alembic) for Phase 2 too. The COMMAND_CENTER originally specified Alembic for content tables, but the Phase 1 raw-SQL pattern works well and keeps a single migration vocabulary. Alembic remains scaffolded for use later if it earns its keep.
- **Articles have a `submitted_by` FK to profiles** even though it's not in the original schema spec. Cheap moderation hook; default null for ingested articles.
- **`articles.search_tsv` is a generated tsvector column** (title:A, author:B, description:C weights) + GIN index. Wires Phase 4 search trivially.
- **Article cards intentionally have no save button.** The doc lists it under Phase 2 but `user_article_states` isn't built until Phase 5. Card has read-link affordance via the whole card being a link to the detail page.
- **`POST /api/events` accepts anonymous tracking.** RLS policy allows insert when `user_id = auth.uid() OR user_id IS NULL`, and the FastAPI bypasses RLS anyway. Click tracking is fire-and-forget from the client; failures must not break navigation.
- **Admin bootstrap is per-request** rather than a SQL trigger. Cheap (one extra SELECT, plus one UPDATE on first time) and avoids encoding the admin list into the DB. Set `ADMIN_BOOTSTRAP_EMAILS` env var to a comma-separated list.
- **Seed articles replaced with verified-live URLs in migration 004.** The original 003 seed used fabricated URLs that almost all 404'd (only Paul Graham's `useful.html` survived). 004 deletes the broken set and inserts 23 articles whose canonical URLs were pulled from each publication's own RSS feed and HEAD-checked. Real ingestion still lands in Phase 3; 004 is a stopgap so `/browse` actually clicks through to something.

---

## Phase 3 — Content Ingestion Pipeline

**Status**: complete

### Completed
- [x] Migration 005: `sources` ingestion-state columns (`last_ingest_etag`, `last_ingest_modified`, `last_ingest_status`, `last_ingest_error`, `last_ingest_article_count`, `consecutive_failures`), new `ingestion_runs` observability table, new `source_default_topics` priors table (29 priors seeded)
- [x] `packages/ingest` built with these modules:
  - `config` — env loading (walks up from CWD for `.env`)
  - `rate_limit` — per-host `asyncio.Semaphore(2)` registry
  - `robots` — async robots.txt cache (6-hour TTL)
  - `rss` — feedparser + conditional GET (`If-None-Match` / `If-Modified-Since`)
  - `og` — httpx + BeautifulSoup OpenGraph metadata
  - `topics` — keyword-map scorer combined with per-source priors
  - `db` — asyncpg thin layer (idempotent inserts on `canonical_url`)
  - `runner` — orchestrates per-source ingest; writes `ingestion_runs` rows
  - `cli` / `__main__` — `python -m longform_ingest --all | --source <slug> | --url <url>`
- [x] FastAPI: `POST /api/admin/sources/{id}/ingest` (admin, queues a background task), `POST /api/ingest/url` (admin, returns OG draft)
- [x] `GET /api/sources` now returns `article_count`, `last_ingest_status`, `last_ingest_article_count`, `last_ingest_error`, `consecutive_failures`
- [x] Admin UI `/settings/sources`: per-source status badge, article count, "Ingest now" button (triggers backend, refreshes after ~3s)
- [x] Admin UI `/settings/articles/new`: "Submit URL" panel that fetches OG metadata via FastAPI and pre-fills the form
- [x] `.github/workflows/ingest.yml`: cron every 6h (UTC) + `workflow_dispatch` for manual runs; `DATABASE_URL` from `secrets.DATABASE_URL`; `concurrency: group=ingest, cancel-in-progress=false`
- [x] Live ingestion verified: 184 new articles pulled across 17/18 active sources on first full run; 1 source (`r/longform`) correctly BLOCKED by Reddit's robots.txt

### Notable Phase 3 decisions
- **GitHub Actions cron over APScheduler.** Already decided in Phase 0 but confirmed in implementation: ingestion runs as `python -m longform_ingest --all` inside a GH Action, no dependency on the FastAPI process being up.
- **`packages/ingest` is installed non-editable on macOS dev.** Root cause: macOS auto-applies `UF_HIDDEN` to `.pth` files in `site-packages` when the venv lives in `~/Documents/Long Form Reading App/...` (path with spaces). Python's `site.py` skips hidden `.pth` files, so PEP 660 editable installs don't get processed — meaning `python -m longform_ingest` fails with `ModuleNotFoundError` despite a successful `pip install -e`. Non-editable installs copy the source into `site-packages/longform_ingest/` directly (directories aren't gated by the hidden flag). Trade-off: `pip install --force-reinstall ../../packages/ingest` after every change to ingest code locally. Linux CI is unaffected. Documented in `services/api/README.md`.
- **`asyncpg` directly in the ingest package**, not SQLAlchemy. The runner is a different process from the API server and doesn't need the ORM. Avoids cross-package model imports.
- **Conditional GET from day one.** Every RSS fetch sends `If-None-Match` and `If-Modified-Since`. 304 responses skip parsing entirely. Per-source `etag` and `last_modified` persist between runs.
- **Per-host concurrency cap of 2.** Default semaphore prevents hammering any one publisher with parallel requests even if many sources happen to share a host.
- **Auto-deactivation after 5 consecutive failures.** `consecutive_failures` resets to 0 on each OK/NO_CHANGES; once it hits `MAX_CONSECUTIVE_FAILURES`, `is_active` flips to false and the source stops being ingested. Admin re-enables via SQL or future admin UI toggle.
- **Background-task model in FastAPI** for the manual "Ingest now" button. `BackgroundTasks` fires the runner after the response returns; the admin UI refreshes 3 seconds later to show new state. For large feeds this is fine; if we ever need to track running jobs we'd switch to writing pending status into `ingestion_runs` immediately.
- **Robots.txt failure is permissive.** If we can't fetch a host's robots.txt, we allow the fetch. Aggressive bots get blocked at the application layer (publication-specific 403s) anyway.
- **Topic auto-tagging is keyword + source priors, not embeddings.** Per the §15 scaling roadmap: keyword matching is "good enough" up to ~50k articles. Embedding swap is a known future migration with no schema change.

### How to run locally
```bash
# After `pip install ../../packages/ingest`:
python -m longform_ingest --source aeon -v       # one source
python -m longform_ingest --all                   # all active sources
python -m longform_ingest --url https://...       # OG fetch only, no DB write
```

### GitHub Actions setup
- Add `DATABASE_URL` to repo secrets (Settings → Secrets and variables → Actions)
- First run via Actions → "Ingest RSS feeds" → "Run workflow"
- Subsequent runs every 6h on the cron

---

## Phase 4 — Discovery & Search

**Status**: complete

### Completed
- [x] `GET /api/articles` extended with:
  - `q` (full-text search via `to_tsvector` / `websearch_to_tsquery` against the GIN-indexed `articles.search_tsv` column from Phase 2)
  - `min_reading_time` / `max_reading_time`
  - `from_date` / `to_date` (publication_date range)
  - `sort` (`newest` | `popular` | `reading_time_asc`)
  - `cursor` (opaque base64-encoded keyset pagination; see `app/cursor.py`)
  - Response now `{ items, next_cursor }` instead of bare array
- [x] `GET /api/search` — cross-type endpoint returning articles (ranked by `ts_rank_cd`) + users (matched on username/display_name)
- [x] `GET /api/topics/{slug}` for the topic page header (article filtering still goes through `/api/articles?topic_slug=`)
- [x] Web: `/browse` rebuilt — `<BrowseFilters>` panel (search, topic, source, reading-time range, date range, sort) + `<ArticleFeed>` masonry CSS-columns grid with `IntersectionObserver`-driven infinite scroll
- [x] Web: `/topics/[slug]` SSR page with header + filtered feed
- [x] Web: `/search` page (input + grouped article/user results)
- [x] Web: `<SearchInput variant="nav">` in the top NavBar (visible md+)
- [x] `apps/web/lib/api-types.ts` — shared client-side types mirroring API responses
- [x] Smoke tests: cursor pagination produces correct page 2; search returns 9 climate articles; filters by min_reading_time work; web pages 200/404 as expected

### Notable Phase 4 decisions
- **Cursor pagination from day one**, per §15 of COMMAND_CENTER. Cursor is opaque to the client: server encodes `{key, id}` as URL-safe base64 JSON. The key is the value of the sort column at the boundary; `id` is the row UUID tiebreaker. Backed by `tuple_(key, id) < (cursor_key, cursor_id)` which Postgres can satisfy with a composite index walk — avoids the `OFFSET` slowdown that hits past ~10k rows.
- **Full-text search rides on the existing `search_tsv` column.** No new schema. The column was added in migration 002 (Phase 2) precisely for this; the GIN index makes search instant at our scale.
- **`reading_time_asc` excludes NULL reading times.** Ascending sort can't tiebreak across NULLs cleanly with tuple compare; cheaper to drop them than special-case.
- **Search-rank ordering is intentionally not paginated.** When `q` is present and search rank is the implicit sort, page 2 won't be cleanly cursor-able (ranks aren't monotone with respect to `created_at`). For now `/api/search` returns top-N only (no pagination). `/api/articles?q=` keeps cursor pagination but orders by the explicit `sort` after filtering by FTS match — clean and predictable.
- **CSS columns over a JS masonry library.** No JS dep, browser handles reflow, looks fine at our card sizes. If we ever want strict left-to-right ordering (CSS columns flow top-to-bottom within each column first), we can swap in `react-masonry-css` then.
- **Skipped `GET /api/topics/{slug}/articles`** as a separate endpoint. `/api/articles?topic_slug=` covers the use case; an alias just duplicates code.

### Surfaces verified
- `/browse` — 200, supports `?q=`, `?topic=`, `?source=`, `?min_minutes=`, `?max_minutes=`, `?from_date=`, `?to_date=`, `?sort=`
- `/topics/[slug]` — 200 for real slugs, 404 for unknown
- `/search`, `/search?q=...` — 200
- `/api/articles?cursor=...` — page 2 returns distinct items from page 1
- `/api/search?q=climate` — 9 articles + 0 users (no users with "climate" in name)

---

## Phase 5+ — Not Started

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
- [ ] **Rotate Supabase DB password** — it was pasted in plaintext into chat earlier; the value is now only in `.env` (gitignored), but chat history retains it. Rotate in Supabase Dashboard → Database → Reset password, then update `.env`.
- [ ] **Rotate Supabase JWT secret + service-role key** at some point if chat history is shared. (Same reason as above.)
- [x] `.env` confirmed gitignored before first commit
- [x] `.env.example` placeholders only
- [x] Stripped credentials from `Longform_Reading_MVP_Scaffolding.md` §14 before commit (replaced with pointer to `.env`)

---

## How to resume after an interruption

1. Read this file top-to-bottom.
2. Read `TaskList` output for the live task state (if same session) or run `git log --oneline -20` (if cross-session).
3. Continue from the first unchecked item in the current Phase block.
4. Update this file as you complete items.
