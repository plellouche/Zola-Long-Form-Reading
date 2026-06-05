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

## Phase 10 — Discovery deck, profile depth, polish

**Status**: shipped scope below; remaining items deferred (see "Skipped")

Plan: `PHASE_10_POLISH.md`.

### Completed
- [x] **Migration `008_phase10_discovery.sql`** (applied to Supabase, verified):
  - `INTERESTED` added to `user_article_states.status` CHECK
  - Event-type CHECK extended with `SWIPE_LEFT/RIGHT/UP/DOWN`, `SOURCE_FATIGUE`
  - `source_follows` table (`user_id`, `source_id`, `created_at`) + RLS (public read, owner-write)
  - `avatars` storage bucket + RLS (public read; per-user folder write/update/delete via `(storage.foldername(name))[1] = auth.uid()::text`)
  - `recount_article_engagement` updated so `INTERESTED` rows count toward `save_count`
- [x] **Recs reinforcement** (`services/api/app/recs/`):
  - `STATUS_WEIGHTS["INTERESTED"] = 0.6` (positive but lighter than SAVED)
  - Recency multiplier ×1.5 on signals updated within 7 days → For-You feed visibly responds to a deck session
  - `score_article(source_followed=, source_fatigued=)` adds +0.1 / ×0.5
  - `for_discover_deck(user_id, limit=25)` — 180d pool, topic-sim weighted 0.5, `max_per_source=4`
  - `SourceFollow` SQLAlchemy model exported from `app.models`
- [x] **Discover router** (`/api/discover/deck`, `/api/discover/swipe`):
  - Direction → state mapping: left=DISMISSED, right=INTERESTED, up=SAVED, down=no state + `SOURCE_FATIGUE` event w/ `metadata.source_id`
  - Idempotent upsert (last-write-wins on re-swipe)
  - Smoke-tested: healthz 200, both discover endpoints 401 when unauth
- [x] **Avatar upload (frontend)**:
  - `<Avatar>` reusable component (hashed-color fallback initial, 5 sizes)
  - `<AvatarUploader>` — file picker → client canvas resize (512×512 WebP) → Supabase Storage upload → PATCH `/api/users/me`
  - Wired into `/settings`; nav-bar + `/u/[username]` header now show avatars
- [x] **Follower / Following lists** (`/u/[username]/followers`, `/following`):
  - Existing endpoints already return `am_following` per row; no backend changes
  - Shared `<FollowList>` component (avatar + display name + @handle + bio + inline Follow button)
  - Profile-header counts now `<Link>`s to the two routes
- [x] **Discover deck UI** (`/discover`):
  - `framer-motion` added (`^12.39.0`)
  - Card stack: top card draggable; 2 back cards scaled + offset
  - Direction labels (Interested / Dismiss / Save) fade in as the card is dragged toward the threshold
  - Action buttons mirror gestures; arrow keys also bound (← → ↑ ↓)
  - "You're caught up" finished-state with "Load more" CTA
  - Counts strip + per-session deck progress
  - `Discover` link added to NavBar for onboarded users
- [x] **Profile depth**:
  - Avatar in `/u/[username]` header alongside display name
  - Follower / following counts are now links (above)
  - New private `Interested` tab on `/u/me` listing INTERESTED state items with Save / Add affordances inherited from `ArticleCard`
  - `Read` tab rebuilt as a day-grouped timeline (date headers + per-day count badges)
- [x] **Source detail page** (`/source/[slug]`):
  - `SourceOut` extended with `followers_count`, `am_following`
  - `POST /api/sources/{slug}/follow` + `DELETE /api/sources/{slug}/follow`
  - `<FollowSourceButton>` client component
  - Page renders header (name, homepage host link, counts, follow button) + recent articles grid
  - Article-detail source name now links to `/source/[slug]` (was `/browse?source=...`)
- [x] **Polish wins**:
  - `<EmptyState>` component (icon + title + body + CTA)
  - Applied across `/u/[username]` tabs (lists / saved / read / interested), `/lists`, `/search` zero-results, and home For-You cold start
- [x] **UI polishes**:
  - Article cards: `motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md` lift on hover
  - `<FeaturedArticleCard>` variant — full-bleed OG image, gradient overlay, white type; used at the top of For-You on `/`
  - `/article/[id]` typography pass: tighter tracking, `text-5xl` title on `sm`, small-caps source line, `max-w-prose` lead paragraph, single-row metadata line
  - Bug fix: `app/error.tsx` was using `<a href="/">` — replaced with `<Link>` so `pnpm build` lints clean

### Skipped (with reasoning)
- **Bulk operations on `/list/[id]`** — per the plan's own caveat ("wait until someone has more than ~30 saves"). Schema already supports it; UI lift not justified yet.
- **Global keyboard shortcuts (J/K, G+B/L/D/H, ?)** — the deck has its own arrow-key handling, which covers the highest-value case. Cross-app J/K navigation is a non-trivial focus-management exercise; defer until requested.
- **Card density toggle** — wide reach (every card-rendering surface needs to consume a `DensityContext`). Defer until anyone asks.
- **Onboarding topic tiles with icons** — current text checklist works; icon mapping per topic slug is bespoke design work without strong signal it's needed.
- **Nav-bar avatar dropdown** — current avatar links straight to the profile and Sign-out / Settings live in the nav for now; dropdown is purely ergonomic.
- **Modal variant for follow lists on desktop** — routes work fine, are shareable, and the modal is duplicate code for marginal UX gain.

### Notable Phase 10 decisions
- **`INTERESTED` as a new state, not a tag.** Reusing `SAVED` would have flooded the Saved tab with every swipe-right; reusing an event-only signal would have skipped the per-article exclusion that prevents the deck from re-showing already-swiped cards. New state lets us both (a) build a feedback profile and (b) hide them from the deck on subsequent loads.
- **Source-fatigue lives as an `events` row, not a `source_fatigues` table.** Cheaper to write, naturally expires when we filter the read query by `created_at >= now() - 7 days`, and uses infrastructure that already exists.
- **Avatar uploads go client-direct to Supabase Storage** (with per-user RLS folder gates), not through FastAPI. Saves a hop and avoids touching the API for blob handling.
- **Client-side canvas resize** before upload — keeps stored avatars small (~30–80KB WebP at 512²) without an image-processing service.
- **Deck scores topic-sim higher (0.5)** than For-You (0.4). The deck is the place to surface things the user might love but freshness/social/quality should weight less; this makes swipes feel decisive.
- **`for_discover_deck` uses a 180d candidate pool** vs. For-You's 90d. New users would run out fast at 90d, and deck-mode is the right place to mine the back catalogue.
- **`source_follows` boost is +0.1 added (not multiplicative)** — small enough to be a tiebreaker, not a hammer. Quality + topic_sim still dominate the ranking.

### Surfaces verified
- `pnpm typecheck` clean across all changes
- `pnpm build` clean; all new routes present: `/discover`, `/source/[slug]`, `/u/[username]/followers`, `/u/[username]/following`
- API smoke: discover endpoints 401 when unauth; routes registered in `app.main.app.routes`
- Migration verified via `psql`: CHECK constraints contain `INTERESTED` + swipe event types; `source_follows` table + indexes + RLS policies present; `avatars` bucket created

---

## Phase 12 — Production Deployment

**Status (2026-05-24)**: shipped (with carry-forward TODOs documented in `DEPLOYMENT.md`). End-to-end production sign-in flow verified. Operational runbook: `DEPLOYMENT.md`. Plan: `ROADMAP.md` Phase 12.

### Shipped
- **Vercel project `zola`** under `paullellouche/zola` (org `team_HJEK7KT4Z4OAUHOewuUDXhXK`, project `prj_oBr0mniHQuqUbW1Wm1yiW4jbSpBu`).
  - Root Directory: `apps/web`. Framework auto-detected (Next.js).
  - Workspace install handled automatically because `pnpm-workspace.yaml` lives at the repo root — Vercel walks up from the Root Directory and installs the whole workspace, then builds the Next.js app.
  - **Live at `https://zolalongform.com`** (custom domain via GoDaddy, SSL via Let's Encrypt). The Vercel-assigned URL `zola-brown-mu.vercel.app` also still resolves and 308-redirects to the custom domain.
  - **Deploys are manual** via `npx vercel --prod --yes` — the GitHub auto-deploy integration was never connected because we created the project via `vercel link` from the CLI. Listed in the DEPLOYMENT.md Carry-forward TODOs.
- **Render service `zola-api`** with the blueprint in `render.yaml` at the repo root.
  - **Live at `https://api.zolalongform.com`** (custom domain via GoDaddy, SSL via Let's Encrypt).
  - Python 3.12; build `pip install -r requirements.txt && pip install ../../packages/ingest`; start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
  - Free tier (sleeps after 15 min idle). Kept warm by the `keep-render-awake` GH Actions workflow that pings `/healthz` every 10 minutes.
  - Auto-deploys on push to `main` (Render's `autoDeploy: true`).
- **Database connection from Render via Supabase Session Pooler.** Supabase's direct DB URL is IPv6-only as of 2024 and Render's outbound is IPv4-only, so the API can't reach the direct URL. `DATABASE_URL` on Render uses the Session pooler endpoint (`postgresql+asyncpg://postgres.<ref>:<password>@aws-1-us-east-2.pooler.supabase.com:5432/postgres`). Transaction pooler (port 6543) does NOT work — lacks prepared statements.
- **Supabase Auth**: Site URL `https://zolalongform.com`. Redirect URLs include `https://zolalongform.com/**` and `https://zolalongform.com/auth/callback`. Email confirmation disabled (frictionless signup for the invite-only beta).
- **FastAPI CORS** updated in `services/api/app/main.py`: explicit allow list for `https://zolalongform.com`, `https://www.zolalongform.com`, and the Vercel alias; plus a regex for preview-deploy subdomains.
- **Vercel env vars** (Production): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL` (= `https://api.zolalongform.com`).
- **GH Actions secrets**: `DATABASE_URL` already present (direct connection — GH Actions supports IPv6, so ingestion runs unchanged), `RENDER_API_URL` set for the keep-awake workflow.
- **Resend custom SMTP** for all Supabase Auth emails — see Phase 11 entry below + `DEPLOYMENT.md` § "Email delivery via Resend". Closes the original "Custom Supabase email provider" carry-forward TODO from this phase.

### Carry-forward TODOs (still outstanding — full details in `DEPLOYMENT.md`)
- **Vercel GitHub auto-deploy** — not connected; every Vercel deploy needs `npx vercel --prod --yes` until reconnected.
- **Vercel Preview env vars** — not set; PR-preview deploys would break at runtime.
- **Render free → Starter ($7/mo)** — upgrade once cold-start latency becomes a real complaint.
- **Separate Supabase project for previews** — if PR-preview deploys land, prod and preview shouldn't share a DB.
- **Sentry / error tracking** — Phase 17 trigger.

### Notable Phase 12 decisions
- **Vercel monorepo handling via Root Directory + workspace auto-detect.** Root Directory = `apps/web`; Vercel walks up to install the pnpm workspace from the repo root because `pnpm-workspace.yaml` is there. No custom `vercel.json`.
- **API installs both requirements.txt and the workspace `packages/ingest`** because `routers/ingest.py` imports `longform_ingest` at module load. Build command in `render.yaml` reflects this.
- **Supabase Session pooler URL on Render** to work around IPv6 vs IPv4. See Known Gotchas in DEPLOYMENT.md.
- **Manual Vercel deploys** kept for now (not worth reconnecting GitHub mid-phase). Documented as carry-forward.
- **Preview env vars deferred.** Vercel CLI v54 quirk prevents non-interactive add for the Preview environment; dashboard-only fix when wanted.
- **Free tier across the board** ($0 cost for Vercel + Render + Supabase + GH Actions; ~$15/yr only for the GoDaddy domain). Resend free tier covers email at 100/day.

### Surfaces verified
- `pnpm typecheck` + `pnpm build` clean throughout the phase.
- `https://zolalongform.com` returns 200; all public routes render the Zola brand.
- `https://api.zolalongform.com/healthz` returns 200; DB-touching endpoints (`/api/topics`, `/api/sources`, `/api/articles`) return real data.
- End-to-end smoke test on production: signup → onboarding → save article → open Discover → sign out → forgot-password → click email link → set new password → sign in. All paths confirmed working on `zolalongform.com`.

---

## Phase 11 — Email + Password Auth

**Status (2026-05-23)**: shipped. Plan: `PHASE_11_AUTH.md`.

### Shipped
- **Supabase Auth config**: "Confirm email" disabled. Signup → immediately signed in.
- **`/signup` (new)**: email + password with `zxcvbn-ts` strength meter. Min length 12 chars + score ≥ 2. Calls `supabase.auth.signUp` → routes to `/onboarding`.
- **`/login` rewritten**: primary flow is email + password (`signInWithPassword`). OTP code flow kept as a fallback behind "Use email code instead" — same component, mode-state-driven. "Forgot password?" link → `/forgot-password`.
- **`/forgot-password` (new)**: single email field, calls `resetPasswordForEmail` with `redirectTo` set to `<origin>/auth/reset-password`. Anti-enumeration: same generic "if registered, link is on its way" success message whether the email exists or not.
- **`/auth/reset-password` (new)**: parses access_token + refresh_token from URL fragment, calls `setSession`, shows new-password form, calls `updateUser({password})`, then `signOut()` so the user re-enters credentials. Self-contained — does not rely on global AuthFragmentHandler (race-free).
- **`/settings`** gains a "Change password" section: current + new + confirm. Current password verified via a quick `signInWithPassword` round-trip (Supabase doesn't expose a dedicated "verify password" endpoint, but a successful sign-in is the canonical equivalent).
- **`lib/password.ts`**: shared strength-meter helper. Lazy-initialized `zxcvbn-ts` setup, single `estimateStrength()` API.
- **`/dev/sign-in-as`** untouched — still works for local dev, still refuses to run outside `NODE_ENV=development`.
- **Proofpoint URL-prefetch workaround** (added during smoke-testing on a UMich address): `apps/web/middleware.ts` catches `/?code=<uuid>` at the apex and forwards to `/auth/callback?next=/auth/reset-password`. Corporate / university email scanners prefetch every URL in inbound mail and would consume the one-time PKCE recovery token before the user clicks. With the middleware in place, the click-the-link recovery path works even when the email is delivered to a Proofpoint-scanned inbox. See `DEPLOYMENT.md` § Known Gotchas for the full write-up + the long-term alternative (code-only email template).
- **Resend custom SMTP** wired in to fix delivery failures (Supabase free-tier sender + Resend sandbox were each blocking different recipients). All Supabase Auth emails now ship from `noreply@zolalongform.com` via `smtp.resend.com:465`. Domain `zolalongform.com` is verified at Resend. Full config in `DEPLOYMENT.md` § Email delivery via Resend.

### Decisions
- **OAuth providers (Google / GitHub) deferred to Phase 11.5.** Account-linking edge cases easier to handle after email/password is shipped.
- **Email confirmation OFF for the invite-only beta.** Re-enable before going fully public + before sending any transactional emails.
- **Password complexity**: min 12 chars + zxcvbn score ≥ 2 (≈ "Okay" — guessable but not trivial). No character-class rules per NIST 800-63B.
- **Anti-enumeration** on `/login` and `/forgot-password`: errors say "Email or password is incorrect" / "if registered…" rather than differentiating between "no such user" and "wrong password".
- **Bundle cost**: `/signup` and `/settings` first-load JS jumped to ~970 KB from the zxcvbn-ts English dictionary. Acceptable for now (one-time download per session); revisit with lazy-loading if it becomes a metric.

### Migration note for OTP-era accounts
- Pre-Phase-11 accounts (signed up via OTP) have no password set in `auth.users`.
- They will get "Email or password is incorrect" on the password form until they run "Forgot password" to set one — OR use the "Use email code instead" fallback on `/login`.
- One-time outreach to existing invitees: tell them to either reset their password or use the OTP code option.

### Files touched
- New: `apps/web/lib/password.ts`, `apps/web/app/signup/page.tsx`, `apps/web/app/forgot-password/page.tsx`, `apps/web/app/auth/reset-password/page.tsx`, `apps/web/app/settings/change-password-form.tsx`
- Rewritten: `apps/web/app/login/page.tsx`
- Modified: `apps/web/app/settings/page.tsx` (adds change-password section)
- Backend: untouched (Supabase Auth handles password verification; FastAPI just verifies the JWT)

### Surfaces verified
- `pnpm typecheck` clean across all changes.
- `pnpm build` clean; all new routes built. `/signup` 970 KB, `/settings` 976 KB, `/auth/reset-password` ≈ same family.
- **End-to-end production smoke test (2026-05-24)**: fresh signup → onboarding → save article → Discover → sign out → forgot-password → email arrives in inbox from `noreply@zolalongform.com` → click link → set new password → sign in with new password → change password from `/settings` → all confirmed working on `zolalongform.com`.

---

## Fetch strategies & full-archive backfill

**Status (2026-05-24)**: shipped. The ingestion pipeline now supports four strategies (`rss`, `archive`, `sitemap`, `manual`) selected per-source. Backfilled every source we had a viable index for.

### Why
Before this change, every source had to expose a working RSS feed for the cron to discover articles. RSS feeds typically expose only the most recent 10–20 items, so even for sources we had been polling for weeks (Aeon, Longreads, etc.) we only had a tiny slice of their archive. For sources without RSS at all (Paul Graham, The New Yorker, Wired, The Atlantic, Harper's, National Geographic, …) the cron silently no-op'd — we had 0 articles from them despite the sources being listed as active.

### Shipped

**Schema**: migration `infra/supabase/migrations/009_phase13_fetch_strategies.sql` adds five columns to `public.sources`:
- `fetch_strategy text not null default 'rss'` — one of `rss | archive | sitemap | manual`
- `archive_url`, `archive_link_selector` — archive walker config
- `sitemap_url`, `sitemap_url_pattern` — sitemap walker config
- `min_word_count int not null default 0` — per-source filter for short news items

**Adapters** in `packages/ingest/src/longform_ingest/strategies/`:
- `rss_strategy.py` — wraps existing feedparser + conditional-GET pipeline.
- `archive.py` — fetches `archive_url`, applies a CSS selector, enumerates link hrefs, then fetches each link via `og.fetch_og` for metadata. Capped at 500 candidates/source.
- `sitemap.py` — walks `sitemap.xml`, recursing into sitemap-index XML, filtering URLs by `sitemap_url_pattern` regex (e.g. `^.*\/magazine\/\d{4}\/.*` for The New Yorker). Then per-article metadata fetch + `min_word_count` floor to filter out short news items.
- `manual.py` — no-op. Marks sources where automated discovery isn't viable so they stop tripping the cron's failure counter.

**Runner refactor**: `runner.py` previously inlined RSS logic. Now it picks an adapter via `strategies.for_source(source.fetch_strategy)` and calls a uniform `Strategy.fetch()` returning `StrategyResult { status, candidates, http_status, error, etag, last_modified }`. The insert + topic-tag tail is shared across strategies.

**OG helper enhancement**: `og.parse_html` now also returns `word_count` and `reading_time_minutes` (~225 wpm). `db.insert_article` accepts both. Lets the sitemap/archive paths filter on length and the article-detail page show real reading time on archive-sourced articles (RSS-sourced articles still get this on subsequent re-ingests if we ever revisit the URL).

**SQLAlchemy model updated** (`services/api/app/models/content.py`): the `Source` class now includes the five new columns so any future admin UI can read/write them.

### Per-source configuration

| Source | Strategy | Notes |
|---|---|---|
| Paul Graham | archive | `paulgraham.com/articles.html` + `a[href$=".html"]` + 400-word floor |
| The New Yorker | sitemap | `/magazine/\d{4}/` + 1500-word floor (only the weekly magazine, not the news desk) |
| Wired | sitemap | `/story/` pattern + 1500-word floor (filters out deal/coupon posts) |
| The Atlantic | sitemap | `/magazine/archive/` + 1500-word floor |
| Harper's | sitemap_index | `/archive/` + 1000-word floor |
| National Geographic | sitemap | `/(article\|magazine\|premium-content)/` + 1500-word floor |
| Latitude Media | sitemap | no pattern, 800-word floor |
| Sunday Long Read | sitemap | no pattern, 800-word floor |
| Alpinist | **manual** | sitemap.xml only had homepage; nothing to walk |
| Sidetracked, Austin Vernon | **manual** | no sitemap / no archive index |
| Boston Review, The Rumpus, Reddit /r/longform, 3 Quarks Daily | **manual** | RSS feed broken (empty / 404 / wrong shape); reddit content needs custom link extraction |
| All other previously-working sources | rss (unchanged) | The Conversation, Literary Hub, Nautilus, Longreads, ProPublica, Grist, Aeon, Guernica, Public Books, Paris Review, Adventure Journal, The New Inquiry |

### Article growth

- **Before**: 644 articles across 14 productive sources.
- **Paul Graham backfill alone**: +208 articles (4 hand-submitted → 212 total).
- **Sitemap backfill** of New Yorker, Wired, Atlantic, Harper's, Nat Geo, Latitude Media, Sunday Long Read added several hundred more (final numbers in the post-backfill table written into the commit message).

### Notable decisions
- **Min-word-count is per-source, not global.** Big magazines mix daily news + features in the same sitemap; we need an aggressive floor for them. Small publications can have a lower floor. Default of 0 means existing RSS sources are unchanged.
- **Archive crawl is capped at 500 candidates per source.** Defensive — a misconfigured selector could otherwise enumerate thousands of unrelated links. PG has ~225 essays; this is comfortable.
- **Sitemap crawl recurses through sitemap-index XML** but otherwise visits each URL once, then `og.fetch_og` handles the article-page fetch. Per-host concurrency is gated by the existing `rate_limit.host_semaphore`, so we don't hammer any one source.
- **`manual` strategy for sources without a discovery path** rather than deactivating them. Keeps them visible in admin UI; the cron just skips them (status `NO_CHANGES`).
- **Existing RSS sources continue to work without re-configuration.** Default `fetch_strategy='rss'` + the migration is non-destructive.

### Files touched
- New: `infra/supabase/migrations/009_phase13_fetch_strategies.sql`, `packages/ingest/src/longform_ingest/strategies/{__init__,base,rss_strategy,archive,sitemap,manual}.py`
- Modified: `packages/ingest/src/longform_ingest/runner.py` (full rewrite of `_ingest_one`), `packages/ingest/src/longform_ingest/db.py` (new columns in queries; `insert_article` accepts `word_count` + `reading_time_minutes`), `packages/ingest/src/longform_ingest/og.py` (word-count + reading-time extraction), `services/api/app/models/content.py` (Source model new columns)
- Configuration: per-source SQL applied to set `fetch_strategy` + `archive_url`/`sitemap_url` + `min_word_count`

### Surfaces verified
- Migration applied to Supabase, schema confirmed.
- `pnpm typecheck` clean on web; API imports cleanly.
- End-to-end test on Paul Graham: 212 candidates seen, 208 new inserted (4 dups from prior hand-submitted).
- End-to-end test on Alpinist sitemap correctly identified the source as empty → marked manual.
- Sitemap backfill across 7 sources: full results in the commit message.

### Known follow-up (not blocking)
- **Archive + sitemap strategies re-walk every URL on every cron run** (every 6h). Insert dedupes via `articles.canonical_url` unique constraint, so no duplicates land, but we still fetch each page. Optimization: query `articles.canonical_url` upfront, skip candidate URLs we've already ingested. Saves ~6000 page-fetches/day at current scale.
- **Some failing-RSS sources still configured as `manual`** (Boston Review, The Rumpus, 3 Quarks Daily, Reddit /r/longform). Each has a different fix path — broken RSS URLs, missing feed, or non-trivial extraction (reddit posts → external article links).
- **Sitemap URL-pattern mismatches**: Harper's pulled in 1 article (`/archive/` regex too narrow); Nat Geo pulled in 0 (`/(article|magazine|premium-content)/` doesn't match their actual URL structure). Both need a 10-min pattern audit + re-run.

---

## Phase 13 — Public Landing Page

**Status (2026-05-24)**: shipped. Plan: `PHASE_13_LANDING.md`.

### Shipped
- **`/` (signed-out)** rewritten: full landing page with `<LandingHero>` (wordmark + tagline + subhead + Sign up / Sign in / Browse CTAs), `<ProductExplainer>` three-card grid (Discover / Save / Share with lucide icons + 30-word descriptions), `<SourceBand>` (CSS-only marquee of source names in Spectral, pulled live from `/api/sources`, paused on hover, motion-reduce respected), and a closing CTA card.
- **`/about` (new)**: ~400-word first-person essay on what Zola is, what it isn't, content policy, and who's behind it. CTAs adapt to auth state.
- **`/sources` (new, public)**: sorted-by-article-count grid of all active sources. Each card: name, host, article count badge. Cards link to `/source/[slug]`.
- **Invite-only gate on `/signup`**: server-side check via `NEXT_PUBLIC_INVITE_REQUIRED=true`. When on, `<InviteGate>` shows a code field; codes live server-only in `ZOLA_INVITE_CODES`.
- **Nav-bar**: signed-out viewers now see "Sources" and "About" alongside "Browse".

### Decisions
- **Invite-only ON by default**, controlled by env vars. Codes are doormat security, not real auth — fine for invite-only beta semantics.
- **No per-source hand-written descriptions yet.** `/sources` renders name + homepage host + article count. A `sources.public_description` column + ~50-word human descriptions is a Phase-13.5 polish item.
- **Marketing pages render the same for everyone** — only `/signup` and authenticated routes change behavior with sign-in state.

### Files touched
- New: `apps/web/components/{landing-hero,product-explainer,source-band}.tsx`, `apps/web/app/{about,sources}/page.tsx`, `apps/web/app/signup/invite-gate.tsx`, `apps/web/lib/invite.ts`
- Refactored: `apps/web/app/signup/page.tsx` (now a server component dispatching to the gate); `signup-form.tsx` extracted from the old client page
- Modified: `apps/web/app/page.tsx` (signed-out branch), `apps/web/components/nav-bar.tsx`, `apps/web/app/globals.css` (`@keyframes marquee` + `.animate-marquee` + reduced-motion guard)

### Surfaces verified
- `pnpm typecheck` clean.
- `pnpm build` clean; new routes present: `/about` (153B), `/sources` (171B).
- `<SourceBand>` is fail-soft on ApiError so a Render cold-start doesn't 500 the landing page.

### Carry-forward
- Per-source `public_description` column + hand-written descriptions: 27 × ~50 words ≈ 2 hrs of writing. Lands after first invite cohort feedback.
- Vercel env vars `NEXT_PUBLIC_INVITE_REQUIRED=true` + `ZOLA_INVITE_CODES=…` to set on Production before next deploy.
- OG image for `zolalongform.com` (currently inherits article default). Phase 14 polish.

---

## Phase 13.5 — Polish + content acquisition push

**Status (2026-06-04)**: shipped across many small commits.

### Shipped
- **Hand-rendered favicon** at `apps/web/app/icon.svg`: user-supplied PNG (BFO "Z" on teal `#22577A`) cropped square + embedded base64 inside an SVG clipPath for rounded corners. Several false-starts learned the hard way (`next/og` `ImageResponse` overengineering, Satori woff2 rejection, browser favicon-DB caching, the `www` cert SAN mismatch).
- **Card resilience** for sparse-metadata articles: new `<ArticleImageFallback>` renders one of 8 deterministic muted gradients (seeded by article id) with the source's first letter as a watermark. Wired into `article-card`, `featured-article-card`, `discover-deck`. Meta-line uses a parts-array helper so missing `author`/`date`/`reading_time` doesn't leave stray `·` separators. ~250 Paul Graham essays + other tag-less posts no longer read as broken cards.
- **Per-source `public_description` column** (migration 014) + 46 hand-written ~40-60-word blurbs. Rendered on `/sources` cards and `/source/[slug]` headers. Curator's voice; down-indexes tech/AI per the saved feedback memory.
- **Source expansion** (migration 010 + per-source backfills): 19 new sources across humanities/nature/place/adventure (Hakai, Atlas Obscura, Public Domain Review, Sapiens, Granta, Baffler, The Point, JSTOR Daily, Lapham's, n+1, American Scholar, Dissent, Roads & Kingdoms, Africa Is a Country, Outside, The Drake, bioGraphic, Emergence, The Dial). Brings active sources from 27 → 46.
- **Fetch-strategy retunes**:
  - Harper's switched from sitemap to RSS (Cloudflare was 403'ing the sitemap walker). 10 recent articles ingested.
  - National Geographic sitemap URL fixed (was 1-entry stub) + tightened URL pattern to `{category}/article/{slug}`. 96 articles ingested.
  - The Dial sitemap regex tightened to exclude `/articles/category/*` and `/articles/tag/*` index pages; 18 false-positive index rows deleted in prod.
- **`/lists/[id]` page polish**: read items gray-out + sort to the bottom; "N unread" count in the header. Pure visual reorder — curator's stored ordering preserved.
- **Mixed-source `/browse`**: new `sort=mixed` (default for the wide browse view) uses `row_number() OVER (PARTITION BY source_id ORDER BY created_at DESC)` so page 1 shows one article per source instead of being dominated by whichever publisher we ingested last. 3-tuple cursor (`rank|created_at|id`) keeps keyset pagination clean.
- **Paywall awareness**:
  - Per-article: `articles.access_tier` column (migration 011) populated at ingest from publisher meta tags (`article:content_tier`, schema.org `isAccessibleForFree`). Atlantic emits honest signals; NYer/Wired/Harper's tag everything `free` even when metered.
  - Per-source curator hint: `sources.paywall_hint` (migration 012), seeded `metered` for Atlantic/NYer/Wired/Harper's.
  - `ArticleSummary` model_validator resolves the stricter of `(article.access_tier, source.paywall_hint)` so the UI sees one consolidated value.
  - `<AccessTierChip>` renders "Free quota" (amber) for metered, "Paywall" (gray) for locked. Hidden for free/unknown.

### Carry-forward
- OG image for `zolalongform.com` — currently inherits article default. `next/og` path crashed twice (Satori font issues); deferred to a static PNG generated offline.
- Harper's historical archive — RSS only covers recent. The full 175-year archive is gated behind Cloudflare bot detection; out of scope until a User-Agent allowlist is negotiated.
- `_fonts/` cleanup: the BFO ttf we vendored briefly during the favicon experiments is gone now, but the failed `app/_fonts/` machinery is documented in commit history if anyone wonders.

---

## Phase 17 light — Sentry + monitoring dashboards

**Status (2026-06-03)**: shipped. Activation pending DSN env vars in hosting envs.

### Shipped
- **FastAPI Sentry**: `sentry-sdk[fastapi]==2.18.0` in `services/api/requirements.txt`. `app/main.py` initializes with `StarletteIntegration` + `FastApiIntegration` + `AsyncPGIntegration`. 10% transaction sampling, `send_default_pii=True` per Sentry's current recommendation. Silent no-op when `SENTRY_DSN` is unset.
- **Next.js Sentry**: `@sentry/nextjs` 8.x + `sentry.{client,server,edge}.config.ts` + `instrumentation.ts` + `withSentryConfig` wrap in `next.config.mjs`. `app/error.tsx` pipes through `Sentry.captureException`. Source-map upload gated on `SENTRY_AUTH_TOKEN`.
- **Activation**: Sentry org `zola-bf` created with `javascript-nextjs` (web) and `python-fastapi` (api) projects. DSNs set in Vercel (`NEXT_PUBLIC_SENTRY_DSN`) and Render (`SENTRY_DSN`). Both ends reporting.
- **DEPLOYMENT.md § Monitoring**: one-time setup runbook + dashboards to check weekly (Sentry Issues, Render Metrics, Supabase DB, Vercel Analytics).
- **Real bugs caught by Sentry** within hours of activation: `Follow` has no `.id` column (3 routes silently broken), `select(current.id)` UUID-as-column expression in leaderboard, `204` DELETE handler with `-> None` return annotation (the missing Render deploys for two days were behind this single import-time `AssertionError`).

### Carry-forward
- Alerts: email on error-rate > 1% — not configured yet, just defaults.
- UptimeRobot on `/healthz` — documented in DEPLOYMENT.md, not yet set up.
- Phase 17.5 (PostHog) — documented in ROADMAP as the next escalation.

---

## Admin dashboard + opt-in user directory

**Status (2026-06-03)**: shipped.

### Shipped
- **`GET /api/admin/dashboard`** (admin-gated): totals (users/articles/ratings/finishes/saves), per-day series (signups/DAU/finishes, last 30d), engagement (active 1d/7d/30d, save→finish rate), top-10 lists (articles by finishes, sources by saves + finishes). Single endpoint, ~10 SQL queries.
- **`/admin/dashboard` page**: five headline tiles + three Plotly line charts (drag-to-zoom, hover tooltips, PNG export) lazy-loaded via `plotly.js-basic-dist-min` + `react-plotly.js/factory`. Three top-N tables. Nav `Admin` link points here.
- **`GET /api/admin/users`** (admin-gated): searchable directory joining `profiles` → `auth.users` (for email) → `events` (last active) → `user_article_states` (saved + finished counts). Supports `?q=` and `?days=N`.
- **`/admin/users` page**: search input + time-range filter (1d/7d/30d/90d/all), copy-email per row, signup + last-active dates.
- **Public opt-in directory** at `/users` (signed-in viewers only): migration 018 added `profiles.discoverable boolean default false`. Settings page toggle. `GET /api/users?sort=active|newest|name` returns opt-in profiles with follower counts + `am_following` for the viewer. `<FollowButton>` inline. Closes the "no way to find people to follow" gap.

### Decisions
- **Discoverable is opt-in, not opt-out.** Defaults to hidden — `/u/{username}` stays accessible by URL either way. Long-form readers tend to dislike being indexed.
- **Plotly chosen over Recharts/visx** because the user explicitly wanted plotly's zoom/pan/hover ergonomics. Lazy-load keeps the bundle off the public surface.
- **Admin dashboard sits on existing `events` table** rather than introducing a new analytics layer. PostHog is the next escalation when this runs out of road (documented in ROADMAP § Phase 17.5).

---

## Gamification: ratings, Elo, leaderboard, comments

**Status (2026-06-03)**: shipped end-to-end. Carry-forward: pairwise Elo needs real volume to stabilize.

### Shipped
- **Per-finish rating** (migration 013): `user_article_states.rating` (`LOVED | LIKED | OK | null`). New `PUT /api/me/articles/{id}/rating` endpoint. Inline 3-button strip on the article page appears when `status=FINISHED`.
- **Personal top-rated** at `/u/{username}?tab=top`: public (it's the personal canon). New `GET /api/users/{username}/top-rated` orders by `(tier ASC, elo_score DESC, finished_at DESC)`.
- **Profile stats card** above the tab nav: 6 tiles (Finished / Hours read / Streak / Sources explored / Top source / Avg length). Hidden when the user has zero finishes so brand-new profiles aren't accusatory.
- **Pairwise comparisons** (migration 015): `article_comparisons` table (user_id, article_a < article_b, winner_id, unique-pair-per-user). `<ComparePrompt>` component appears after a rating, asks "Which did you prefer?", chains votes by fetching the next same-tier candidate via `GET /api/me/articles/{id}/compare-candidate`.
- **Elo ranking** (migration 016): `article_elo_ratings` (user_id, article_id, score, comparison_count). `app/elo.py` implements standard Elo with K=32, initial 1200. `submit_comparison` atomically inserts the vote + applies the Elo update to both articles. Top-rated query orders by Elo within tier.
- **Hours leaderboard** at `/leaderboard`: scoped to viewer + people they follow (NOT global — global rewards skim-reading). Tabs for `week|month|all_time`. New `GET /api/leaderboard/hours?period=...`.
- **Article comments** (migration 019): flat (no threading), signed-in to write, public to read. Soft delete via `deleted_at`. `GET/POST /api/articles/{id}/comments`, `DELETE /api/comments/{id}` (owner or admin). Inline `<Comments>` component at the bottom of every article page; 2000-char limit, auto-linkified URLs, optimistic delete.
- **Discover deck rating weighting**: `for_discover_deck` now blends a per-article rating score (Bayesian-soft floor for low-rater articles) at 15% of the score. Articles with no ratings stay neutral (0.5) so unrated content isn't penalized.

### Carry-forward
- Elo is path-dependent until enough comparisons exist. A batch Bradley-Terry recompute is the next iteration once the comparison pool grows.
- Notifications on reply / mention: not built.
- Markdown in comments: explicitly skipped — plain-text + auto-link only.
- Threading: skipped per design — flat keeps the surface text-first.

---

## Phase 18 — Embeddings + semantic search

**Status (2026-06-04)**: end-to-end shipped. Backfill running in GHA cron (~72% as of last check).

### Shipped
- **pgvector schema** (migration 017): `articles.embedding vector(384)` matching `sentence-transformers/all-MiniLM-L6-v2`. Partial index where `embedding is not null`. HNSW index deferred until article count crosses ~10k (currently 3,468).
- **Embedding pipeline** in `packages/ingest`:
  - `[embeddings]` optional dep group (`sentence-transformers` + `torch` CPU). Base ingest install stays light — Render API doesn't need ML deps.
  - `embeddings.py`: lazy-loaded model, `compute_embedding` + `compute_embeddings_batch`. Normalized output for cheap cosine = dot product.
  - `backfill_embeddings.py`: window-driven, Ctrl-C-safe, pgvector `[v1,v2,...]::vector` literal cast for asyncpg.
- **GHA `ingest.yml`**: installs `[embeddings]` extra, caches the 80MB HuggingFace model between runs, runs `backfill_embeddings --limit 500` after each ingest tick. Timeout bumped 20m → 30m.
- **Embedding-based recs** in `services/api/app/recs/`:
  - `profile.py` new `build_user_embedding_profile()` — weighted centroid of the user's positively-signaled article embeddings. Status weights + recency boost + DISMISSED-pulls-away semantics match the topic profile. Returns `None` during cold start so callers fall back.
  - `scorer.py` new `dense_cosine()` helper; `score_article()` takes optional `similarity` kwarg that overrides topic cosine when supplied.
  - `feed.py` `for_you_feed` + `for_discover_deck` + `related_articles` all now blend `dense_cosine(user_emb, article_emb) * 0.7 + topic_cosine * 0.3` when both sides have embeddings; topic-only otherwise. Degrades gracefully through the backfill window.
- **Semantic search** at `/api/search?mode=keyword|semantic|hybrid` with `mode_used` in response:
  - Semantic: embed query, find nearest articles by pgvector `<=>` (cosine distance).
  - Hybrid: interleave keyword + semantic ranks, dedupe by id.
  - Behind `SEMANTIC_SEARCH_ENABLED` env var since the model (~250MB RAM) is tight on Render free tier. Falls back to keyword silently when off / model unavailable / no embedded articles yet.

### Decisions
- **Local sentence-transformers, not OpenAI**, per the roadmap. Free, runs in GHA, no per-query cost. Tradeoff: query-time embedding needs sentence-transformers in the API runtime, which Render free tier can barely fit.
- **Blend, don't swap** topic + embedding cosine. Embedding is the workhorse but topic-dict captures explicit interests the user picked in onboarding.
- **HNSW deferred** — sequential scan is faster than HNSW overhead below ~10k articles.

### Carry-forward
- Activate semantic search in production (`SEMANTIC_SEARCH_ENABLED=true` on Render + install `sentence-transformers` there) — likely needs Render Starter tier first.
- HNSW index when article count crosses 10k.
- Per-user score precomputation (`feed_cache` table) when live scoring at request time becomes expensive.
- Log search queries as a new event type → autocomplete + saved-search digests.

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
