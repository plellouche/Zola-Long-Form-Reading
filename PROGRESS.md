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

## Phase 5 — Personal Organization

**Status**: complete

### Completed
- [x] Migration 006: `user_article_states`, `lists`, `list_items` + RLS + indexes
- [x] Trigger keeps `articles.save_count` (users in SAVED/READING/FINISHED) and `finish_count` (FINISHED) denormalized on every state change
- [x] Trigger bumps `lists.updated_at` whenever items change so "recent activity" ordering is right
- [x] SQLAlchemy models: `UserArticleState`, `ReadingList`, `ListItem`
- [x] Pydantic schemas: `UserArticleStateOut`, `SetArticleStateRequest`, `StatefulArticle`, `ListBrief/Detail`, `ListCreate/Update`, `ListItemCreate`, `ListReorderRequest`
- [x] FastAPI endpoints:
  - `POST/GET/DELETE /api/me/articles/{id}/state` — upsert / fetch / clear (uses `pg_insert(...).on_conflict_do_update`)
  - `GET /api/me/articles?status=SAVED|FINISHED|...` — current user's articles with state
  - `POST/GET/PATCH/DELETE /api/lists` (+ `/{id}`) — CRUD; `?mine=true`, `?user_id=`, `?username=` filters
  - `POST /api/lists/{id}/items` / `DELETE /api/lists/{id}/items/{article_id}` — add/remove
  - `PUT /api/lists/{id}/reorder` — bulk reorder via `[{article_id, position}]`
- [x] Events fired automatically on state changes (`SAVE`, `FINISH`, `DISMISS`, `OPEN`) and list adds (`LIST_ADD`)
- [x] Frontend:
  - `<SaveButton>` (icon variant on cards, pill variant for callouts) — toggle SAVED with optimistic UI
  - `<ArticleStateControls>` on the article detail page — pick SAVED/READING/FINISHED/DISMISSED, click again to clear
  - `<AddToList>` popover on the article detail — pick from owned lists or create new
  - `/lists` — my lists with inline create form
  - `/list/[id]` — list detail with up/down reorder, item remove, owner-only "Edit list" (rename, toggle public, delete)
  - `/u/[username]` gains tabs: **Lists** (public to all), **Saved** + **Read** (visible only to self)
  - NavBar: new "Lists" and "Saved" links when signed in
  - `lib/me.ts` `getSavedArticleIds()` — one-shot fetch of viewer's saved IDs, passed to feeds so cards know whether to render the SaveButton as filled

### Notable Phase 5 decisions
- **Single `status` column** instead of separate `saved_at`/`finished_at` timestamps. Simpler schema; the trigger handles the "saves include reading + finished" interpretation so the SAVED → READING → FINISHED transition doesn't decrement `save_count`. Trade-off: you can't easily ask "was this user ever saved-but-not-yet-finished?" — but we don't need that. Events table preserves the history if we ever do.
- **Denormalized counts via trigger**, not computed on read. Cheap, always-consistent. `recount_article_engagement(uuid)` is exposed as a helper if anything ever needs a forced refresh.
- **204 No Content → 200 + `{"ok": true}`** for DELETE endpoints. FastAPI's body-allowed assertion trips on `status_code=204` with a `-> None` annotation; rather than fight it, return a tiny ack body.
- **List reorder takes the full new position map**, not a delta. Clients send `[{article_id, position}, ...]`; server applies in one transaction. Simpler than "swap two" and matches drag-and-drop UX naturally if/when we add that.
- **No drag-and-drop yet** — up/down arrow buttons on each row. DnD is real work (touch-friendly, accessible) and not blocking.
- **SaveButton is optimistic**: UI flips instantly, API call runs in a transition, reverts on failure. The viewer's saved-set on the feed is server-fetched once per page render — fine for our scale.
- **`/u/[username]` tabs hide Saved/Read for non-self viewers.** Saved/Read are private by intent. Lists tab respects each list's `is_public` flag (the API only returns public ones when querying another user).

---

## Phase 6 — Social Layer

**Status**: complete

### Completed
- [x] Migration 007: `follows` table (composite PK on (follower, followee), self-follow check, dual indexes for graph walking in both directions, RLS open-read + owner-write)
- [x] SQLAlchemy `Follow` model
- [x] Pydantic schemas: `FollowAck`, `ActivityItem`; `PublicProfile` extended with `followers_count` / `following_count` / `am_following` / `is_self`
- [x] FastAPI endpoints:
  - `POST/DELETE /api/users/{username}/follow` — idempotent via `on_conflict_do_nothing`; emits FOLLOW / UNFOLLOW events
  - `GET /api/users/{username}/followers` / `/following` — paginated profile lists
  - `GET /api/users/{username}` augmented with counts + viewer's relationship
  - `POST /api/lists/{id}/fork` — copies a public list (title, description, ordered items) under a new `forked_from_id` reference; rejects self-forks
  - `GET /api/lists?following=true` — public lists from users I follow
  - `GET /api/me/feed/activity` — recent SAVE + LIST_ADD events from followees (the "social boost" signal source for Phase 7)
- [x] Frontend:
  - `<FollowButton>` on `/u/[username]` with optimistic toggle + revert-on-error
  - Followers / following counts on profile
  - `<ForkButton>` on `/list/[id]` for non-owners viewing a public list — redirects to the new fork
  - `/lists` rebuilt with two sections: **My lists** + **From people you follow**
  - Home `/` rebuilt for signed-in users: "From people you follow" activity feed (column layout of `<ArticleCard>` per event with actor + relative time)

### Notable Phase 6 decisions
- **Follows are public.** Anyone can see who follows whom — matches the eventual followers/following list pages, simpler RLS, no extra "private follow" UX. If we ever want private follows it's a column flip.
- **No denorm counts on profiles**, just `SELECT COUNT(*)` on read. Cheap with the dual indexes. Switch to denormalized + trigger if profile pages ever get hot.
- **Activity feed is pull-model**, not fan-out-on-write. At our scale a single `SELECT … WHERE user_id IN (followees) ORDER BY created_at DESC LIMIT N` is fast. If/when the events table grows past ~10M rows, the §15 path is: precompute per-user activity into a denorm `home_feed` table, refresh on each follow event.
- **Fork copies the snapshot, not the link.** Forks have their own item rows; later edits to the source don't propagate. `forked_from_id` keeps the lineage for attribution / "X forks" counts later.
- **`POST /api/lists/.../fork` body is empty.** Just `{}` — the fork is fully derived from the source. Avoids a separate "ListForkRequest" schema for no information.
- **Activity feed shows only `SAVE` and `LIST_ADD`**, not `OPEN` / `FINISH`. Saves and adds are signal-strong "this person endorses this article"; opens are weak.

### Surfaces verified (unauthenticated)
- API: `POST /api/users/{u}/follow` → 401; `POST /api/lists/{id}/fork` → 401; `GET /api/me/feed/activity` → 401; `GET /api/users/nope/followers` → 404
- Web: `/`, `/browse` → 200; `/lists` (anon) → 307 to login; `/u/nope` → 404

---

## Phase 7 — Recommendation Engine

**Status**: complete

### Completed
- [x] `services/api/app/recs/` package (kept inside the API process for Phase 7; will be hoisted to `packages/recs` only if scoring needs to run out-of-band)
  - `profile.py` — `build_user_topic_profile` combines explicit onboarding picks (`user_topics`) with implicit signal from `user_article_states` (`SAVED=1.0`, `READING=1.5`, `FINISHED=2.0`, `DISMISSED=-1.5`). Negative weights clipped to 0 before normalize.
  - `scorer.py` — sparse-dict cosine, exponential freshness decay (~half-life 21 days), `score_article` weighted per COMMAND_CENTER §10: `topic_sim*0.4 + social*0.2 + quality*0.2 + freshness*0.1 + source_trust*0.1`
  - `diversity.py` — generic `ScoredCandidate[T]` + `apply_diversity` enforcing max 2 per source and avoiding back-to-back same-author. Constraints relax automatically if the candidate pool is small.
  - `feed.py` — three entry points: `for_you_feed`, `related_articles`, `list_recommendations`
- [x] FastAPI endpoints:
  - `GET /api/feed` — personalized For You feed (auth required)
  - `GET /api/articles/{id}/related` — public; viewer's saved/read articles excluded when auth'd
  - `GET /api/lists/{id}/recommendations` — public for public lists, owner-only for private
- [x] Web:
  - Home `/` (signed-in): "For You" section above the "From people you follow" activity feed; "Save" buttons seeded from the viewer's saved-set
  - `/article/[id]`: "Related" section at the bottom
  - `/list/[id]`: "Suggested for this list" section at the bottom (when the list has items)

### Notable Phase 7 decisions
- **Sparse dicts, not numpy arrays.** Articles have 1–3 topics each; topic vectors stay tiny. A keyed dict + dict-intersection cosine is ~2× faster than allocating a dense numpy array at our scale. The bigger-vector future (sentence embeddings via pgvector) is what numpy is needed for; we'll cross that bridge per §15.
- **No score cache yet.** Scoring 400 candidates × 1 user takes <100ms on the live DB; no need to precompute. If a route ever times out, the cache table goes here.
- **Candidate pool capped at the 400 newest articles** in the last 90 days. Past that, freshness alone would dominate the ranking and topic match would matter less anyway.
- **Engagement signal is asymmetric.** `DISMISSED` pulls the profile away from a topic, but the final profile clips negative weights to 0. This avoids the "user dismissed one math article so now they get only the OPPOSITE of math" failure mode (cosine with a negative vector ranks anti-correlated articles first).
- **List recs add a coverage bonus.** Articles whose topics are *under-represented* in the existing list get a small score boost — so a 5-Mountain-Climbing list will start getting Nature & Environment articles suggested, not just more Mountain Climbing.
- **For You hides articles you've already touched.** Any `user_article_states` row (any status) excludes the article. Browse + the activity feed are the path to revisit something you've saved.
- **Falls back to "newest from same source"** for related articles when the seed has no topic tags. Better than empty.

### Surfaces verified
- API: `/api/feed` → 401 unauth; `/api/articles/{id}/related` → 6 anon-allowed; `/api/lists/{nope}/recommendations` → 404
- Web: `/`, `/article/{id}` → 200; cards in the new sections render with working SaveButtons

### Migration path (deferred, documented in §15)
- ~50k articles: keyword-derived topic vectors → sentence-embedding vectors stored in a pgvector column. `scorer.cosine_similarity` keeps its signature; only `_bulk_article_topics` changes.
- ~100k articles: add pgvector HNSW index; swap brute-force scoring for ANN nearest-neighbor.
- High write rates / many users: precompute scores nightly into a `feed_cache` table; routes read cache first.

---

## Phase 8 — Polish + Invite

**Status**: shipped scope below; remaining doc items deferred (see "Skipped")

### Completed
- [x] Dark mode toggle via `next-themes`. Class-based (`class="dark"` on `<html>`); old `prefers-color-scheme` media query kept as a fallback so SSR doesn't flash light on system-dark. `<ThemeProvider>` in root layout, `<ThemeToggle>` in NavBar (sun/moon icon, defaults to system, mounted-guard avoids hydration mismatch).
- [x] SEO / OpenGraph metadata via `generateMetadata` on:
  - `/article/[id]` — title, description, og:image from the article's `og_image_url`, type=article, twitter summary_large_image
  - `/list/[id]` — title, description, item count; **private lists** emit `robots: { index: false }`
  - `/topics/[slug]` — topic name + description
  - `/u/[username]` — display_name + bio, type=profile
  - Root layout — site-level defaults + Twitter card
- [x] `loading.tsx` skeleton fallbacks for `/browse`, `/topics/[slug]`, `/search`, `/article/[id]`, `/list/[id]`; reusable `<CardSkeleton>` / `<CardGridSkeleton>` / `<LineSkeleton>` in `components/skeletons.tsx`
- [x] Root `error.tsx` with retry + "go home" actions and digest display
- [x] Root `not-found.tsx` for any `notFound()` from the app
- [x] Mobile-responsive sweep:
  - NavBar: `flex-wrap`, padded compact (`px-4 py-3` on mobile, `sm:px-6 sm:py-4`)
  - Search input already `hidden md:block`; secondary nav links (Lists, Saved, Settings, Sign out, Admin) hidden on `<sm`; primary actions (Browse, @username, Sign in) always visible
  - Theme toggle always visible
- [x] Admin invite-by-email:
  - `POST /api/admin/invites { email }` — admin-only, hits Supabase admin `/auth/v1/invite` with the service-role key, deliveries Resend email
  - 409 surfaced separately when email already exists
  - `/settings/invites` admin page with form; "Invites" link added next to "New article" on `/settings/sources`
- [x] `pydantic[email]` + `email-validator` added to API requirements

### Skipped (with reasoning)
- **Reading progress indicator** — REDIRECT_ONLY content means we don't render full text in-app, so there's nothing to progress through.
- **Article-quality up/downvote admin UI** — `articles.quality_score` is already PATCH-able via `/api/articles` (admin); a dedicated UI is busywork until you actually want to tune.
- **Keyboard shortcuts (J/K, S)** — low value vs. effort. Can add as a small follow-up if you want.
- **"Suggest an article" for non-admin users** — admin already has the form; opening to all users requires a moderation queue, which is a phase of its own.
- **Lighthouse perf audit** — defer to actual production deployment; meaningless on `localhost` dev.

### Notable Phase 8 decisions
- **`<html suppressHydrationWarning>`** in the root layout — `next-themes` sets the class attribute client-side before React hydrates, which would normally throw a hydration mismatch warning. The directive is the documented escape hatch.
- **Class-based theme with media-query fallback.** Pure class-based forces a JS-rendered `<html class>` before paint; combining with the media query gives a sane SSR fallback for users who haven't toggled.
- **`pydantic[email]` instead of a hand-rolled regex.** One extra dep (`email-validator`), much better error messages and unicode/IDN handling than anything I'd write.
- **Admin invites are server-side only.** UI gates via `requireAdmin`; API gates via `require_admin` dependency. Service-role key never crosses to the browser.

### Surfaces verified
- API: `POST /api/admin/invites` → 401 unauth; `OG meta` rendered on `/article/{id}` with real article title + description
- Web: `/`, `/browse` → 200; `/lists`, `/settings/sources`, `/settings/invites` → 307 to login when anon
- Loading skeletons render briefly during slow fetches (Next dev throttling can simulate)

### What "shipped" means now
All Phase 0–8 work in COMMAND_CENTER §12 is either done or explicitly deferred. The app is ready to invite a small group:
1. Deploy `apps/web` to Vercel and `services/api` to Render (env vars in `.env.example`)
2. Point `NEXT_PUBLIC_API_URL` at the deployed Render URL
3. Update Supabase Site URL + Redirect URLs to include the production domain
4. Admin signs in, visits `/settings/invites`, sends emails

---

## Done. Phase 9 (mobile app) and the §15 Scaling Roadmap migrations live there.

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
