# Longform Reading App — Command Center

> **Status**: Pre-development planning phase
> **Last updated**: 2026-02-25
> **This file is the authoritative reference for all architecture, data model, and phased development decisions.**

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [Non-Goals (MVP)](#2-non-goals-mvp)
3. [Tech Stack](#3-tech-stack)
4. [Architecture Overview](#4-architecture-overview)
5. [Repository Structure](#5-repository-structure)
6. [Data Model](#6-data-model)
7. [Content Policy & Copyright Rules](#7-content-policy--copyright-rules)
8. [Curated Sources (Seed List)](#8-curated-sources-seed-list)
9. [Ingestion Pipeline](#9-ingestion-pipeline)
10. [Recommendation Engine](#10-recommendation-engine)
11. [Routes & Pages](#11-routes--pages)
12. [Phased Development Plan](#12-phased-development-plan)
13. [Hosting & Deployment](#13-hosting--deployment)
14. [Decision Log](#14-decision-log)
15. [Scaling Roadmap](#15-scaling-roadmap)
16. [Future Improvements](#16-future-improvements)

---

## 1. Product Vision

**"Pinterest for long-form reading"** — a high-signal discovery and reading app for essays, articles, trip reports, academic journalism, and literary nonfiction.

### Core differentiators
- Curated, high-trust source allowlist (no AI slop, no low-effort content)
- Reading lists as first-class objects (create, share, fork)
- Recommendation engine at the center of gravity — personalized "For You" feed + per-list recommendations
- Social graph: follow people whose taste you trust, not just publications
- Copyright-safe by design: store metadata + links, redirect to source by default

### The problem it solves
- Substack: low signal-to-noise
- Atlantic/Harpers etc.: paywalled, stylistic monoculture
- Longreads: weak recommendation system, no social layer
- No good "Pinterest for articles" exists

---

## 2. Non-Goals (MVP)

- No creator/publishing tools
- No paywall bypassing or full-text scraping of copyrighted content
- No perfect ML recommendation system on day one
- No public marketplace or monetization
- No notifications (push/email) in early phases
- No mobile app in early phases (structure will support it later)

---

## 3. Tech Stack

### Rationale summary
Next.js was chosen over Vite/React for SSR on article metadata pages, file-based routing, and Vercel-native deployment. FastAPI was chosen because Python familiarity and the recommendation + ingestion packages are Python-native. Supabase eliminates auth, RLS, and storage boilerplate on a generous free tier.

### Frontend — `apps/web`
| Concern | Choice | Notes |
|---|---|---|
| Framework | **Next.js 15 (App Router)** | SSR for article/list pages, file-based routing, image optimization |
| Language | **TypeScript** | Full type safety across frontend + shared packages |
| Styling | **Tailwind CSS** | Utility-first, fast iteration |
| Component library | **shadcn/ui** | Headless, copy-paste components, Tailwind-native |
| State management | **Zustand** (light global) + React Query | Server state via React Query; minimal global state via Zustand |
| API client | `packages/api-client` | Typed fetch wrapper, shared with future mobile app |

### Backend — `services/api`
| Concern | Choice | Notes |
|---|---|---|
| Framework | **FastAPI** (Python 3.12) | Async, auto-generated OpenAPI docs, Pydantic models |
| ORM | **SQLAlchemy 2.0** (async) | Matches Supabase Postgres; Alembic for migrations |
| Auth verification | **Supabase JWT** | FastAPI verifies Supabase-issued JWTs using shared secret — no separate auth logic |
| HTTP client | **httpx** | Async, used by both API and ingestion |
| Task queue | **APScheduler** (MVP) → Celery later | Cron ingestion jobs; upgrade if scale demands |

### Database + Auth — Supabase
| Concern | Choice | Notes |
|---|---|---|
| Database | **Supabase (Postgres 15)** | Managed, backups, extensions (pg_vector for future embeddings) |
| Auth | **Supabase Auth** | Email magic links + Google OAuth. JWT passed to FastAPI. |
| Storage | **Supabase Storage** | Article cover images, user avatars |
| Row Level Security | **Supabase RLS** | Enforce data access rules at DB level |

### Packages
| Package | Language | Purpose |
|---|---|---|
| `packages/shared` | TypeScript | Shared types/interfaces used by web + api-client + future mobile |
| `packages/api-client` | TypeScript | Typed HTTP client wrapping FastAPI endpoints |
| `packages/recs` | Python | Recommendation engine (scoring, ranking, diversity) |
| `packages/ingest` | Python | RSS ingestion, OG metadata fetching, robots.txt compliance |

### Infrastructure
| Concern | Choice |
|---|---|
| Frontend hosting | **Vercel** (free tier) |
| Backend hosting | **Render** (free tier → paid as needed) |
| Database | **Supabase** (free tier → Pro at $25/mo) |
| CI | **GitHub Actions** |
| Package manager | **pnpm** + pnpm workspaces |

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                      │
│                  Next.js 15 App Router                   │
│         SSR pages + React client components              │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS (REST)
                       │ Authorization: Bearer <supabase_jwt>
                       ▼
┌─────────────────────────────────────────────────────────┐
│                  FastAPI Backend                          │
│   • Verifies Supabase JWT (no separate auth service)     │
│   • Article, List, User, Follow, Event endpoints         │
│   • Calls packages/recs for recommendation scoring       │
│   • Calls packages/ingest for on-demand URL fetch        │
└───────────────┬─────────────────────┬───────────────────┘
                │                     │
    SQL (asyncpg)│            Supabase Storage
                ▼                     │
┌──────────────────────┐   ┌──────────▼──────────────────┐
│  Supabase Postgres   │   │    Supabase Storage          │
│  • All app data      │   │  • Cover images, avatars     │
│  • RLS policies      │   └─────────────────────────────┘
└──────────────────────┘
                ▲
                │  (also direct from browser for auth only)
┌──────────────────────┐
│   Supabase Auth      │
│  • Magic link/Google │
│  • Issues JWTs       │
└──────────────────────┘

┌─────────────────────────────────────────────────────────┐
│            Background Jobs (APScheduler)                 │
│   packages/ingest: RSS poll every 4-6 hours             │
│   packages/recs:   Score refresh on demand / nightly    │
└─────────────────────────────────────────────────────────┘
```

**JWT flow**: User logs in via Supabase Auth (browser) → receives JWT → sends it with every API request → FastAPI verifies JWT signature using `SUPABASE_JWT_SECRET` environment variable → extracts `user_id` → proceeds. No separate auth service needed.

---

## 5. Repository Structure

```
longform/
├── apps/
│   ├── web/                        # Next.js 15 frontend
│   │   ├── app/                    # App Router pages
│   │   ├── components/             # UI components
│   │   ├── lib/                    # Client utilities, hooks
│   │   └── public/
│   └── mobile/                     # Expo React Native (Phase 9+, placeholder only)
│
├── packages/
│   ├── shared/                     # TypeScript types shared across apps
│   │   └── src/types/              # Article, List, User, Topic interfaces
│   ├── api-client/                 # Typed fetch wrapper for FastAPI
│   │   └── src/
│   ├── recs/                       # Python recommendation engine
│   │   ├── scorer.py
│   │   ├── diversity.py
│   │   └── list_recs.py
│   └── ingest/                     # Python ingestion pipeline
│       ├── rss.py
│       ├── og_fetcher.py
│       └── robots.py
│
├── services/
│   └── api/                        # FastAPI application
│       ├── app/
│       │   ├── main.py
│       │   ├── routers/            # articles, lists, users, recs, events
│       │   ├── models/             # SQLAlchemy models
│       │   ├── schemas/            # Pydantic request/response schemas
│       │   └── auth.py             # JWT verification
│       ├── alembic/                # DB migrations
│       └── requirements.txt
│
├── infra/
│   └── supabase/
│       ├── migrations/             # SQL migration files
│       ├── seed/                   # Seed data (sources, topics)
│       └── policies/               # RLS policy definitions
│
├── docs/                           # Additional design docs
├── .github/workflows/              # CI pipelines
├── pnpm-workspace.yaml
└── COMMAND_CENTER.md               # This file
```

---

## 6. Data Model

### Entity overview

```
User ──< Follow >── User
User ──< UserArticleState (status, rating) >── Article
User ──< ArticleComparison >── (Article, Article)        # Beli-core pairwise votes
User ──< ArticleEloRating >── Article                    # per-user, per-article Elo
User ──< List ──< ListItem >── Article
User ──< Comment >── Article                             # flat, soft-deletable
Article ──< ArticleTopic >── Topic
Article >── Source                                       # paywall_hint, public_description
Article.embedding pgvector(384)                          # sentence-transformer
User ──< Event
```

**Migrations applied** (as of 2026-06-04): 001–019. Recent ones beyond the original phased plan, in order:
- `010` — humanities source expansion (Hakai, Atlas Obscura, Lapham's, n+1, Granta, etc.)
- `011` — `articles.access_tier`
- `012` — `sources.paywall_hint`
- `013` — `user_article_states.rating`
- `014` — `sources.public_description`
- `015` — `article_comparisons`
- `016` — `article_elo_ratings`
- `017` — `articles.embedding` + pgvector extension
- `018` — `profiles.discoverable`
- `019` — `comments`

### Table definitions

#### `profiles` (extends Supabase `auth.users`)
```sql
id              UUID PRIMARY KEY  -- FK → auth.users.id
username        TEXT UNIQUE NOT NULL
display_name    TEXT
avatar_url      TEXT
bio             TEXT
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

#### `sources`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
name            TEXT NOT NULL           -- "Aeon", "Nautilus"
slug            TEXT UNIQUE NOT NULL    -- "aeon", "nautilus"
homepage_url    TEXT NOT NULL
rss_url         TEXT                    -- nullable if no RSS
content_policy  TEXT NOT NULL           -- REDIRECT_ONLY | EMBED_ALLOWED | FULLTEXT_ALLOWED
trust_score     FLOAT DEFAULT 0.7       -- prior for recommendation ranking (0–1)
is_active       BOOLEAN DEFAULT true
last_ingested_at TIMESTAMPTZ
created_at      TIMESTAMPTZ DEFAULT now()
```

#### `topics`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
name            TEXT NOT NULL           -- "Mountaineering", "Philosophy"
slug            TEXT UNIQUE NOT NULL
description     TEXT
parent_id       UUID REFERENCES topics(id)  -- nullable, for hierarchy
```

#### `articles`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
source_id       UUID NOT NULL REFERENCES sources(id)
title           TEXT NOT NULL
author          TEXT
publication_date DATE
canonical_url   TEXT UNIQUE NOT NULL
og_image_url    TEXT
description     TEXT                    -- og:description or excerpt
reading_time_minutes INT               -- estimated, computed from word_count
word_count      INT
content_policy  TEXT NOT NULL           -- inherits from source, can override
full_text       TEXT                    -- NULL unless FULLTEXT_ALLOWED
quality_score   FLOAT DEFAULT 0.5       -- admin-assigned or computed
save_count      INT DEFAULT 0           -- denormalized for ranking
finish_count    INT DEFAULT 0           -- denormalized for ranking
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

#### `article_topics`
```sql
article_id      UUID REFERENCES articles(id) ON DELETE CASCADE
topic_id        UUID REFERENCES topics(id) ON DELETE CASCADE
weight          FLOAT DEFAULT 1.0       -- strength of topic association
PRIMARY KEY (article_id, topic_id)
```

#### `user_article_states`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id         UUID NOT NULL REFERENCES profiles(id)
article_id      UUID NOT NULL REFERENCES articles(id)
status          TEXT NOT NULL           -- SAVED | READING | FINISHED | DISMISSED
opened_at       TIMESTAMPTZ
finished_at     TIMESTAMPTZ
time_spent_seconds INT DEFAULT 0
updated_at      TIMESTAMPTZ DEFAULT now()
UNIQUE (user_id, article_id)
```

#### `lists`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id         UUID NOT NULL REFERENCES profiles(id)
title           TEXT NOT NULL
description     TEXT
is_public       BOOLEAN DEFAULT true
forked_from_id  UUID REFERENCES lists(id)  -- nullable
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

#### `list_items`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
list_id         UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE
article_id      UUID NOT NULL REFERENCES articles(id)
position        INT NOT NULL            -- for drag-to-reorder
added_at        TIMESTAMPTZ DEFAULT now()
UNIQUE (list_id, article_id)
```

#### `follows`
```sql
follower_id     UUID NOT NULL REFERENCES profiles(id)
followee_id     UUID NOT NULL REFERENCES profiles(id)
created_at      TIMESTAMPTZ DEFAULT now()
PRIMARY KEY (follower_id, followee_id)
CHECK (follower_id != followee_id)
```

#### `events`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id         UUID REFERENCES profiles(id)
article_id      UUID REFERENCES articles(id)
event_type      TEXT NOT NULL  -- OPEN | FINISH | SAVE | DISMISS | LINK_CLICK | LIST_ADD | FOLLOW | UNFOLLOW
metadata        JSONB DEFAULT '{}'
created_at      TIMESTAMPTZ DEFAULT now()
```

---

## 7. Content Policy & Copyright Rules

**Default stance**: store metadata and outbound links only. Never store or display full text unless explicitly permitted.

### Policy levels

| Policy | Behavior | Storage |
|---|---|---|
| `REDIRECT_ONLY` | Article card shows metadata; "Read" button opens external URL in new tab | Title, author, description, OG image, canonical URL |
| `EMBED_ALLOWED` | Can embed official iframe/widget if source provides one | Same as above + embed URL |
| `FULLTEXT_ALLOWED` | Full text stored and rendered in-app | Full text stored in `articles.full_text` |

### Ingestion rules
- **RSS feeds**: fetch metadata only (title, description, link, pub_date, author) — do NOT store full article body from RSS even if included
- **Submit URL**: fetch OpenGraph tags + canonical URL only — no full-HTML scraping
- **robots.txt**: always check and respect before crawling any domain
- **Source-level notes**: each source record documents its allowed ingestion method

### MVP stance on all curated sources
All 12 initial sources = `REDIRECT_ONLY` unless individually confirmed otherwise. This is the safe default.

---

## 8. Curated Sources (Seed List)

| Source | Domain | RSS Available | Notes |
|---|---|---|---|
| Aeon | aeon.co | Yes | Philosophy, science, culture |
| Latitude Media | latitudemedia.com | Check | Energy/climate journalism |
| Nautilus | nautil.us | Yes | Science + philosophy |
| Longreads | longreads.com | Yes | Literary nonfiction, essays |
| Public Books | publicbooks.org | Yes | Academic literary criticism |
| Orion Magazine | orionmagazine.org | Yes | Nature, environment |
| Guernica | guernicamag.com | Yes | Politics, arts, global culture |
| The Alpinist | alpinist.com | Check | Mountaineering |
| Sidetracked | sidetrackedmagazine.com | Check | Adventure/exploration |
| Adventure Journal | adventure-journal.com | Yes | Outdoor adventure |
| Boston Review | bostonreview.net | Yes | Politics, philosophy, culture |

Initial topic taxonomy (seed):
`Philosophy`, `Science`, `Nature & Environment`, `Mountaineering & Climbing`, `Adventure & Exploration`, `Politics & Society`, `Culture & Arts`, `Literature & Essays`, `Energy & Climate`, `History`, `Technology`, `Economics`

---

## 9. Ingestion Pipeline

### Flow

```
Source (RSS URL)
  → packages/ingest/rss.py
  → Parse feed entries (feedparser)
  → For each entry: check robots.txt, fetch OG tags (httpx)
  → Deduplicate by canonical_url
  → Upsert into articles table (metadata only)
  → Tag with source_id, auto-assign topics (keyword matching MVP → embeddings later)
  → Emit INGEST event
```

### Submit URL flow (manual)
```
User submits URL in UI
  → POST /api/ingest/url
  → packages/ingest/og_fetcher.py fetches OG tags
  → Returns draft article metadata for user to confirm/edit
  → On confirm: insert into articles, auto-tag, mark submitter
```

### Cron schedule
- RSS poll: every 6 hours per active source
- Implemented via APScheduler in FastAPI process (MVP) — move to Celery + Redis for scale

### Auto-topic tagging (MVP strategy)
1. Keyword matching: map known keywords to topic IDs (e.g., "glacier", "alpinism" → Mountaineering)
2. Source-level default topics: each source has a default topic weight (Alpinist → Mountaineering: 0.9)
3. Phase 7+: replace with sentence embeddings (OpenAI or local model) for semantic tagging

---

## 10. Recommendation Engine

**Current state (2026-06-04)**: hybrid embedding + topic cosine blend, plus aggregate rating signal on the discover deck. See PROGRESS.md § Phase 18 for the implementation history.

### Signals used

| Signal | Weight | Notes |
|---|---|---|
| **Embedding similarity** | **High (workhorse)** | Cosine between user-centroid embedding and article embedding (sentence-transformers all-MiniLM-L6-v2). When both sides are embedded, this is 70% of the similarity component; topic-dict cosine fills in the other 30% |
| Topic overlap | Medium | Cosine of `{topic_id: weight}` dicts. Falls back to primary signal during embedding cold start |
| User saves | High | Strong positive signal |
| User finishes | Very high | Strongest positive signal |
| Aggregate ratings | Medium (discover deck) | LOVED=2 / LIKED=1 / OK=0 averaged across raters, Bayesian-soft floor. 15% of discover-deck score |
| Social boost | Medium | Saved/finished by followed users |
| Source trust prior | Medium | `sources.trust_score` as baseline |
| Freshness | Medium | Decay function on publication date |
| Dismissed | Negative | Hard exclude from feed |
| Already opened | Slight negative | De-rank, don't exclude entirely |

### Diversity constraints
- Max 2 articles per source in top-10 results
- Ensure at least 3 distinct topics represented in top-10
- Penalize back-to-back same-author

### Feed types

#### "For You" feed
1. Build user topic profile from their save/finish history
2. Candidate pool: unseen articles from last 90 days
3. Score each candidate: `topic_sim * 0.4 + social_boost * 0.2 + quality * 0.2 + freshness * 0.1 + source_trust * 0.1`
4. Apply diversity constraints
5. Return top N

#### "Because you saved X"
- Take topic vector of article X
- Find top-K articles with highest cosine similarity
- Exclude already-saved/dismissed

#### "Recs for List Y"
- Build topic profile of list (union of all article topic vectors, weighted by position)
- Find articles that complement the list: high similarity to profile AND not already in list
- Add a "coverage" bonus for topics underrepresented in the list

### Implementation plan
- MVP: numpy + scikit-learn (TF-IDF + cosine similarity), scores computed on-demand and cached in Redis (or Postgres table)
- Phase 7+: consider sentence embeddings (all-MiniLM-L6-v2 or similar) for richer semantic matching
- Phase 8+: lightweight collaborative filtering layer on top

---

## 11. Routes & Pages

### Frontend routes (Next.js App Router)

| Route | Page | Auth required |
|---|---|---|
| `/` | For You feed (or landing if logged out) | No (shows curated top for anon) |
| `/browse` | Browse all articles (filter by topic/source) | No |
| `/topics/[slug]` | Topic-specific article feed | No |
| `/article/[id]` | Article detail: metadata, tags, read button | No |
| `/read/[id]` | In-app reader (only for FULLTEXT_ALLOWED) | Yes |
| `/lists` | My lists + lists from people I follow | Yes |
| `/list/[id]` | List detail + list recs | No (public lists) |
| `/u/[username]` | User profile + public lists | No |
| `/search` | Search articles, lists, users | No |
| `/settings` | Profile settings | Yes |
| `/settings/sources` | Admin: manage sources | Admin only |
| `/onboarding` | Topic interest selection on signup | Yes |

### API routes (FastAPI)

```
GET  /api/articles           # browse, filter, paginate
GET  /api/articles/{id}      # article detail
POST /api/ingest/url         # submit URL for OG fetch

GET  /api/feed               # personalized For You feed
GET  /api/feed/list/{id}     # recs for a specific list

GET  /api/topics             # all topics
GET  /api/topics/{slug}/articles

GET  /api/lists              # user's lists
POST /api/lists              # create list
GET  /api/lists/{id}
PUT  /api/lists/{id}
DELETE /api/lists/{id}
POST /api/lists/{id}/items   # add article to list
DELETE /api/lists/{id}/items/{article_id}
PUT  /api/lists/{id}/reorder # update positions

GET  /api/users/{username}
GET  /api/users/{username}/lists

POST /api/follow/{username}
DELETE /api/follow/{username}

POST /api/events             # track opens, finishes, dismissals

GET  /api/admin/sources
POST /api/admin/sources
PUT  /api/admin/sources/{id}
POST /api/admin/ingest/{source_id}  # trigger manual RSS pull
```

---

## 12. Phased Development Plan

### Phase 0 — Foundation & Scaffolding
**Goal**: Monorepo running locally, deployed skeletons, all tools configured.

**Tasks**:
- [ ] Create GitHub repo + pnpm monorepo (`pnpm-workspace.yaml`)
- [ ] Scaffold `apps/web` with Next.js 15 + TypeScript + Tailwind + shadcn/ui
- [ ] Scaffold `services/api` with FastAPI + health check endpoint
- [ ] Create Supabase project, store connection string + JWT secret in `.env`
- [ ] Scaffold `packages/shared` with initial TypeScript type stubs
- [ ] Scaffold `packages/api-client` with base fetch wrapper
- [ ] Set up Alembic in `services/api` for migrations
- [ ] Deploy Next.js to Vercel (empty), FastAPI to Render (empty)
- [ ] GitHub Actions: lint + type check on PR
- [ ] `.env.example` with all required environment variables documented

**Done when**: `pnpm dev` runs both apps locally; health check endpoint returns 200; empty Next.js app deploys to Vercel.

---

### Phase 1 — Auth & User Profiles
**Goal**: Users can sign up, log in, and have a profile.

**Tasks**:
- [ ] Enable Supabase Auth (email magic link + Google OAuth)
- [ ] Create `profiles` table migration + trigger (auto-create profile on signup)
- [ ] FastAPI JWT verification middleware (`auth.py`)
- [ ] `GET /api/users/{username}` endpoint
- [ ] Next.js: Supabase Auth client setup, login page, auth state in layout
- [ ] User profile page `/u/[username]`
- [ ] Settings page (edit display name, bio, avatar upload to Supabase Storage)
- [ ] Protect routes that require auth (middleware in Next.js)
- [ ] Onboarding page: select initial topic interests (stored in `user_article_states` or separate `user_topics` table)

**Done when**: Can sign up with Google, see profile page, edit it.

---

### Phase 2 — Core Data Model & Manual Article Entry
**Goal**: Articles exist in the database; can be browsed and viewed.

**Tasks**:
- [ ] DB migrations: `sources`, `topics`, `articles`, `article_topics`
- [ ] Seed data: 11 sources with `REDIRECT_ONLY` policy + trust scores
- [ ] Seed data: 12 initial topics with slugs
- [ ] Admin API endpoints: CRUD for sources + manual article creation
- [ ] Simple admin UI page at `/settings/sources` (gated to admin role)
- [ ] Manually enter 20–30 articles across sources to bootstrap library
- [ ] Article browse page `/browse` — simple grid of cards
- [ ] Article detail page `/article/[id]` — metadata, tags, "Read Article" button (external link)
- [ ] Article card component (title, source, author, reading time, topic tags, save button)
- [ ] Track `LINK_CLICK` event when user clicks "Read Article"

**Done when**: Can browse articles, click through to source, see metadata.

---

### Phase 3 — Content Ingestion Pipeline
**Goal**: New articles automatically pulled from RSS feeds, with the production-shape concerns built in from the start (rate limits, conditional GET, robots.txt, observability).

**Tasks**:
- [ ] Migration: add ingestion state columns to `sources` (`last_ingest_etag`, `last_ingest_modified`, `last_ingest_status`, `last_ingest_error`, `last_ingest_article_count`) + new `ingestion_runs` table for observability
- [ ] `packages/ingest`: feedparser, httpx, python-dateutil, beautifulsoup4 deps
- [ ] `robots.py`: `RobotsCache` — per-host robots.txt fetch + parse, with TTL
- [ ] `rate_limit.py`: per-host `asyncio.Semaphore` registry (default 2 concurrent)
- [ ] `rss.py`: fetch feed with `If-None-Match` / `If-Modified-Since` from source state; parse via feedparser; normalize to article dicts; return `(articles, new_etag, new_modified)`
- [ ] `og.py`: given URL, fetch + parse OpenGraph tags (httpx + bs4), respecting robots.txt
- [ ] `topics.py`: keyword map → topic_slugs; combined with per-source default topic weights
- [ ] `runner.py`: `ingest_source(source_id)` async function — idempotent (canonical_url unique); writes new articles + topic links; records an `ingestion_runs` row
- [ ] `cli.py`: `python -m longform_ingest --all` or `--source <slug>`
- [ ] FastAPI: `POST /api/admin/sources/{id}/ingest` triggers `runner.ingest_source` in the background
- [ ] FastAPI: `POST /api/ingest/url` returns draft OG metadata for admin review (no DB write)
- [ ] `/api/sources` response includes `article_count` and ingestion stats
- [ ] Admin UI: `/settings/sources` shows last_ingested_at, last status, article count, "Ingest now" button
- [ ] Admin UI: "Submit URL" button on `/browse` → OG draft → confirm + save form
- [ ] `.github/workflows/ingest.yml` runs `python -m longform_ingest --all` every 6 hours (cron) and on manual workflow_dispatch
- [ ] Anchor seed `articles_default_topics` mapping for each source (e.g. `alpinist` → `mountaineering-climbing` weight 0.9)

**Done when**: GH Actions cron runs successfully against all active sources; new articles appear in `/browse` without manual intervention; admin can re-ingest one source on demand; `ingestion_runs` shows per-run stats.

---

### Phase 4 — Discovery & Search
**Goal**: Browsing and finding articles feels good.

**Tasks**:
- [ ] Filtering: by topic, by source, by reading time range, by date range
- [ ] Sorting: newest, most saved, reading time
- [ ] Full-text search using Supabase's `to_tsvector` / `pg_search` on title + description + author
- [ ] `GET /api/topics` and `/api/topics/{slug}/articles` endpoints
- [ ] Topic page `/topics/[slug]` with filtered article grid
- [ ] Pagination / infinite scroll on browse + topic pages
- [ ] Masonry-style responsive card grid layout
- [ ] Search page `/search` with results across articles, lists, users

**Done when**: Can filter by topic, search for articles, scroll through a paginated feed.

---

### Phase 5 — Personal Organization
**Goal**: Users can save, track, and organize articles into lists.

**Tasks**:
- [ ] DB migrations: `user_article_states`, `lists`, `list_items`
- [ ] `UserArticleState` CRUD: save, mark as reading, mark as finished, dismiss
- [ ] Track `SAVE`, `FINISH`, `DISMISS` events
- [ ] Save button on article card (toggle save state)
- [ ] Reading history page (profile → "Read" tab)
- [ ] Saved articles page (profile → "Saved" tab)
- [ ] Lists CRUD endpoints: create, read, update, delete
- [ ] List detail page `/list/[id]` with articles, reorder, remove
- [ ] Add-to-list UI: from article card, open popover to pick list or create new
- [ ] "My Lists" page `/lists`
- [ ] Reading time tracking: log time spent when user exits article (can be rough)

**Done when**: Can save articles, create lists, add articles to lists, view reading history.

---

### Phase 6 — Social Layer
**Goal**: Follow people, see their lists, fork them.

**Tasks**:
- [ ] DB migration: `follows`
- [ ] Follow/unfollow endpoints + follow state in user profile
- [ ] Follow button on user profile page
- [ ] "Followers / Following" counts on profile
- [ ] Following feed: list of public lists from followed users on `/lists` page
- [ ] User profile `/u/[username]` shows their public lists
- [ ] Fork/copy a list: creates a copy with `forked_from_id` reference
- [ ] "Social boost" signal wired into event tracking (saves from followed users)
- [ ] Basic activity: "People you follow saved X" section on home feed (simple, not real-time)

**Done when**: Can follow users, see their lists, fork a list into your own.

---

### Phase 7 — Recommendation Engine
**Goal**: "For You" feed feels personalized; list recs are useful.

**Tasks**:
- [ ] `packages/recs`: install numpy, scikit-learn, pandas
- [ ] Build topic vector representation for each article (from `article_topics` weights)
- [ ] Build user topic profile from `user_article_states` (weighted by SAVE > FINISH > OPEN)
- [ ] Implement cosine similarity scorer (`scorer.py`)
- [ ] Implement freshness decay function
- [ ] Implement social boost computation
- [ ] Implement diversity constraints (`diversity.py`)
- [ ] `GET /api/feed` endpoint: calls recs package, returns scored article list
- [ ] `GET /api/feed/list/{id}`: list-profile-based recs (`list_recs.py`)
- [ ] Precompute + cache feed scores (Postgres table or in-memory cache) to avoid per-request compute
- [ ] "For You" feed on homepage `/`
- [ ] "Because you saved X" related articles on article detail page
- [ ] "Recs for this list" section on list detail page
- [ ] Onboarding cold-start: use selected topics as initial profile when no history exists

**Done when**: For You feed shows articles that match demonstrated interests; list recs help fill gaps in a reading list.

---

### Phase 8 — Polish & Invite
**Goal**: App is presentable to a small invited group.

**Tasks**:
- [ ] Mobile-responsive design pass across all pages
- [ ] Dark mode (Tailwind + shadcn support this natively)
- [ ] Empty states for new users (no saves, no lists, etc.)
- [ ] Loading skeletons for all feed/list components
- [ ] Error boundaries + graceful error states
- [ ] "Suggest an article" feature (submit URL with note)
- [ ] Article quality score: admin can upvote/downvote articles to tune rankings
- [ ] Reading progress indicator (for long article cards)
- [ ] Keyboard shortcuts (J/K navigation, S to save)
- [ ] Simple invite system: generate invite codes or use Supabase invite by email
- [ ] SEO: Open Graph meta tags on article and list pages (Next.js metadata API)
- [ ] Performance audit: Lighthouse pass, image optimization

**Done when**: Can send invite link to a friend; they can sign up, follow you, and use the app end-to-end.

---

### Phase 10 — Discovery Deck, Profile Depth, Polish

Detailed plan: `PHASE_10_POLISH.md`. Status: shipped — see `PROGRESS.md` "Phase 10".

**Goal**: a swipe surface that trains the recommender, profile depth (avatars + Instagram-style follower lists), source pages, and broad polish (empty states, featured cards, typography).

**Highlights**:
- New `INTERESTED` state on `user_article_states`; recency multiplier on profile signal so the feed responds within a deck session
- `/discover` swipe deck (framer-motion); arrow keys + on-screen actions
- Avatars via Supabase Storage `avatars` bucket, client-resized to 512² WebP
- `/u/[username]/followers` and `/following` routes; profile counts now linked
- `/source/[slug]` page; per-source follows (`source_follows` table) feed a +0.1 score boost
- `<FeaturedArticleCard>` variant for the top of For-You; `<EmptyState>` applied across surfaces

### Phase 9 — Mobile App Foundation (Future)
**Goal**: iOS/Android app sharing core logic with web.

**Tasks**:
- [ ] Scaffold `apps/mobile` with Expo + React Native + TypeScript
- [ ] `packages/api-client` already exists — wire up to mobile
- [ ] `packages/shared` types already exist — confirm compatibility
- [ ] Core screens: Home (For You), Browse, Article Detail, Lists, Profile
- [ ] Supabase Auth in Expo (expo-auth-session for OAuth)
- [ ] Push notifications (Expo Notifications)
- [ ] Offline reading: cache FULLTEXT_ALLOWED articles locally

---

## 13. Hosting & Deployment

### Services map

| Service | Provider | URL pattern |
|---|---|---|
| Frontend (Next.js) | Vercel | `longform.vercel.app` → custom domain |
| Backend (FastAPI) | Render | `api.longform.app` |
| Database + Auth | Supabase | Managed |
| Storage (images) | Supabase Storage | Via Supabase CDN |

### Environment variables

```bash
# apps/web
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=https://api.longform.app

# services/api
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=   # server-side only, never expose to client
SUPABASE_JWT_SECRET=         # for JWT verification
DATABASE_URL=                # postgres connection string from Supabase
```

### CI/CD (GitHub Actions)
- On PR: lint, type-check, run tests
- On merge to `main`: auto-deploy frontend to Vercel, auto-deploy API to Render

---

## 14. Decision Log

| Date | Decision | Rationale | Alternatives considered |
|---|---|---|---|
| 2026-02-25 | Next.js 15 App Router over Vite/React | SSR for article pages, file-based routing, Vercel-native | Vite + React (simpler but no SSR) |
| 2026-02-25 | FastAPI (Python) backend | Python familiarity, natural fit for recs/ingest packages | Node.js/Express (would lose Python ecosystem for recs) |
| 2026-02-25 | Supabase for DB + Auth | Bundles Postgres + Auth + RLS + Storage, generous free tier | Separate Postgres + Auth0/Clerk (more setup, less cohesive) |
| 2026-02-25 | pnpm workspaces (monorepo) | Simple, no build tool complexity, works for this scale | Turborepo (overkill for MVP), Nx (too heavy) |
| 2026-02-25 | All sources default to REDIRECT_ONLY | Conservative copyright stance, legally safe from day one | Full-text scraping (copyright risk) |
| 2026-02-25 | APScheduler for cron (MVP) | No additional infrastructure; upgrade path to Celery when needed | Celery + Redis (premature for MVP) |
| 2026-02-25 | Web-first, mobile-later architecture | Monorepo structured with shared packages from day one to avoid migration cost | Web-only forever, separate mobile codebase |
| 2026-05-17 | GitHub Actions cron over APScheduler | Render free tier sleeps; ingestion logic is Python; GH Actions free tier covers 30 sources × 4 runs/day easily | APScheduler (sleeps with API), Supabase pg_cron (can't run Python) |
| 2026-05-17 | Raw SQL migrations in `infra/supabase/migrations/`, not Alembic | Phase 1 needed `auth.users` triggers Alembic can't touch; consistency wins over autogeneration for MVP scale | Alembic (still scaffolded, available if it earns its keep later) |

---

## 15. Scaling Roadmap

This section documents the production-shape pressure points and the specific migrations needed at each volume threshold. The schema is already designed to absorb most of these without restructuring; this is the **what changes when**.

### Core principle: relevance, not volume

Storage is essentially free at the volumes we care about (100k articles × ~1 KB metadata = 100 MB, trivial on Supabase Pro). The hard problem is **discovery** — making 10k articles feel like 50 great ones to each user. The schema's `events`, `user_article_states`, `quality_score`, `save_count`, and `finish_count` columns exist from day one so that once you have ~100 users generating signals, ranking improves automatically. **You do not curate at scale by hand; the users implicitly do it.**

### Volume thresholds

| Threshold | What changes | Effort |
|---|---|---|
| **~1k articles** (end of Phase 3, ~weeks) | RSS poll already running. Keyword-based topic tagging is "good enough." | Already done. |
| **~10k articles** | `OFFSET`-based pagination starts to slow. Switch `/api/articles` to cursor pagination (`WHERE (created_at, id) < (cursor)`). Keyword tagging starts producing noticeable false positives — start collecting OG image dimensions to filter podcast/video junk. | ~1 day |
| **~50k articles** | Replace keyword topic tagging with sentence embeddings (`text-embedding-3-small` at ~$0.02 / 1k articles, or local `all-MiniLM-L6-v2`). Store as `pg_vector` column. Cosine search is still brute-force but acceptable. | ~3 days |
| **~100k articles** | Add HNSW index on the embeddings column for approximate nearest neighbor. Add a janitor cron: archive articles >2yr old with zero saves into a cold table; mark canonical URLs that 404 for 30 days as dead. | ~2 days |
| **~30 sources** (now) | Per-host `asyncio.Semaphore(2)` rate limit + conditional GET. Built into Phase 3. | Built in. |
| **~200 sources** | Move ingestion from one big GH Action job to a fan-out matrix (parallel jobs by source). Add per-domain backoff state. | ~1 day |
| **~1k users generating signals** | Wire `quality_score` recompute from save-rate × finish-rate × dwell, nightly. Currently a static prior. | ~1 day |
| **~10k MAU** | Outgrow Render free + Supabase free. Render Starter ($7/mo) + Supabase Pro ($25/mo). Consider moving recs compute off the API process to a separate worker. | Infra change, not code |

### What stays REDIRECT_ONLY forever

Storing full text is a legal and operational liability we shouldn't take on. The path forward is metadata + outbound link, period. The `FULLTEXT_ALLOWED` policy exists for sources we explicitly license or for our own essays — not as a scraping escape hatch.

### What we explicitly defer

These look like obvious wins but trap effort or scope:

- **Real-time freshness** (sub-hour). Longform is, by definition, not a news app. Polling every 6h is correct.
- **Human curation queue.** Bottlenecks on the operator. Source-level trust score + per-article user signals does the work — and is the entire point of the recs engine.
- **Cross-source dedup beyond canonical_url.** Two outlets running the same essay is rare and not worth fuzzy-matching effort until users complain.
- **Auto-scraping of paywalled outlets.** Copyright risk + abuse-detection risk. `PAYWALLED_FREE_SUBSET` sources only get articles that are confirmed free.
- **Article-level moderation API.** Wait for user reports. Premature otherwise.

### Per-source ingestion etiquette (locked in Phase 3)

- robots.txt respected before any fetch.
- One User-Agent identifying the app + an email contact.
- `If-None-Match` / `If-Modified-Since` on every RSS fetch — 304 means we don't re-parse the feed.
- Max 2 concurrent fetches per host.
- Exponential backoff on 429/5xx; mark source `is_active=false` after 5 consecutive failures (admin re-enables manually).
- Per-run stats land in `ingestion_runs` (Phase 3 migration); dashboard reads them later.

---

## 16. Future Improvements

Items consciously deferred during Phases 0–8 that aren't scale-triggered (those live in §15). Each entry includes why it was deferred and what triggers picking it up.

> **For larger phase-sized initiatives** (auth, deployment, marketing home, themes, in-app reader, mobile, observability), see **`ROADMAP.md`** at the repo root. This section is for small backlog items; `ROADMAP.md` is the forward plan for Phase 11+.

### UX polish

**Drag-and-drop list reorder** — current `/list/[id]` uses up/down arrow buttons per row. DnD that's accessible, touch-friendly, and survives keyboard nav is non-trivial; `dnd-kit` is the standard. Pick up when at least one user complains, or when adding multi-select.

**Keyboard shortcuts** — J/K to navigate cards in feeds, S to save the focused card, G then B / G then L to jump to Browse / Lists, ? for a cheat-sheet overlay. Useful for keyboard-heavy users but low value for first invite cohort. ~1 day of focused work.

**Bulk operations** — multi-select on `/lists`, the saved tab, and inside list detail. Once selected: delete N items, move N items between lists, mark N as finished. Schema doesn't need changes; API endpoints accept arrays. Wait until someone has more than ~30 saves and is annoyed.

**Reading progress indicator** — visible "you're 40% through this article" badge or progress bar. Only meaningful for `FULLTEXT_ALLOWED` content (which is currently zero); skip until we have in-app rendering.

**Card density toggle** — compact / comfortable / spacious modes on `/browse`. Cheap polish; can ride along with a settings page rework.

### Reader

**`/read/[id]` in-app reader** — for articles whose `content_policy = FULLTEXT_ALLOWED`. Currently nothing matches that policy. Requires:
- Updating `packages/ingest` to pull the full body when allowed (and respecting source licensing)
- A reader page with typography (Tailwind Typography plugin), scroll progress, mark-as-finished CTA, font-size control
- A "Read in app" affordance on cards/article detail when the policy permits

**Reading time auto-tracking** — client-side beacon (`navigator.sendBeacon`) on `visibilitychange` / `beforeunload` that increments `user_article_states.time_spent_seconds` for the current article. Column exists; the route handler stub doesn't. Useful once we have reader pages — for redirect-only outbound clicks the signal is noisy and we already log a `LINK_CLICK` event.

### Content flow

**User "Suggest an article" with moderation queue** — currently `/settings/articles/new` is admin-only. Opening it to all users requires:
- `articles.status` column: `PENDING | PUBLISHED | REJECTED`
- Admin queue at `/settings/articles/pending` to approve / reject; rejected entries optionally surface a note to the submitter
- Email or in-app notification when status changes
- Rate-limit per user (e.g. 3 submissions/day)

**User-submitted source proposals** — same shape but at the source level. Lower priority; sources are stable.

**Pinned / featured articles** — admin can pin a list of N articles to surface on `/` for non-personalized "editor's picks." Simple `articles.is_featured` boolean. Useful when first onboarding new users who have no saved history yet.

### Admin tooling

**Article quality up/downvote UI** — `articles.quality_score` is already PATCH-able via the existing API; a small ±0.05 button on `/settings/articles/pending` (or the article detail page when viewed by an admin) would make tuning ergonomic. Trivial to add once the moderation queue lands.

**Source ingestion-history viewer** — render the `ingestion_runs` table as a table at `/settings/sources/{id}/runs`. Useful when a source starts failing intermittently; currently only available via direct SQL.

**Admin user moderation** — soft-delete a profile, revoke admin role, suspend account. Wait until there's an actual misuse incident; YAGNI otherwise.

**Per-source default-topics editor** — `source_default_topics` is currently seeded only via SQL. A UI for editing the weights helps tune ingestion-time auto-tagging without touching migrations.

### Search & ranking

**Multilingual search** — current `to_tsvector('english', ...)` is English-only. If we add non-English sources, this needs to either auto-detect language per article or store multiple language columns. Wait until we deliberately add a non-English source.

**Saved-search alerts** — user saves a query (topic + filter combo), gets a digest email when new matching articles arrive. Email infrastructure is already there via Resend; needs a `saved_searches` table and a daily/weekly job.

**Trending feed** — a "what's been saved most this week" view. Needs a denormalized weekly count on articles, plus a job to refresh it. Cheap once we have ~hundreds of users.

### Performance & operations

**Lighthouse audit + image optimization** — defer to actual production deployment. Image optimization means swapping `<img>` for `<Image>` (Next.js) on cards and article detail; impact is real for mobile data but invisible on localhost.

**Per-route HTTP caching strategy** — `/browse` results can be cached briefly by the CDN; `/api/feed` is personalized and must not be cached. Audit cache headers when we deploy.

**API response compression** — Render does this automatically; if we self-host or move to a different host, enable gzip/brotli at the proxy.

**Sentry / structured error logging** — root `error.tsx` currently just `console.error`s. Real error tracking lands when there are real users.

**FastAPI request logging + slow-query log** — `uvicorn --access-log` plus a SQL slow-query log feeding into Supabase's built-in metrics or an external APM. Wait until something feels slow in production.

### Mobile (Phase 9)

The doc's Phase 9 (Expo + React Native sharing `packages/shared` types and `packages/api-client`) lives here as a future improvement until prioritized. Stack already structured to absorb it without restructuring.

### Anti-features (explicitly not doing)

For clarity, here's what's been actively rejected — not just deferred:

- **Full-text scraping of paywalled content.** Copyright + ToS risk.
- **Auto-curating "what's popular elsewhere"** via Twitter/Reddit/HN scraping. Becomes a moderation nightmare; defeats the high-signal curation thesis.
- **Real-time ingestion** (sub-hour). Longform isn't a news app; 6h polling is correct.
- **Cross-source dedup beyond `canonical_url`.** Two outlets running the same essay is rare; fuzzy-matching isn't worth the effort until users complain.
- ~~**In-app commenting / threading.**~~ **Reconsidered and shipped flat comments (2026-06-04).** Signed-in to write, public to read, no markdown, no threading. Still rejecting: nested threads, comment voting/sort, rich-text bodies.
- **Algorithmic re-ranking that hides articles entirely.** The recs engine surfaces, never hides. `DISMISSED` is user-driven.

---

*This document is the authoritative source of truth. Update it as decisions are made, phases complete, or scope changes.*

*Last reviewed: 2026-06-04 — after Phase 17 light + Phase 18 first slice + gamification (ratings/Elo/pairwise/leaderboard/comments) shipped.*
