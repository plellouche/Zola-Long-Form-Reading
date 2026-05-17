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
User ──< UserArticleState >── Article
User ──< List ──< ListItem >── Article
Article ──< ArticleTopic >── Topic
Article >── Source
User ──< Event
```

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

### Signals used

| Signal | Weight | Notes |
|---|---|---|
| Topic overlap | High | Cosine similarity of article topic vectors |
| User saves | High | Strong positive signal |
| User finishes | Very high | Strongest positive signal |
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
**Goal**: New articles automatically pulled from RSS feeds.

**Tasks**:
- [ ] `packages/ingest`: install feedparser, httpx, python-dateutil
- [ ] `rss.py`: fetch feed, parse entries, normalize to article schema
- [ ] `og_fetcher.py`: given URL, fetch OG tags (title, description, image, author, date)
- [ ] `robots.py`: check robots.txt before fetching any URL
- [ ] Deduplication by `canonical_url`
- [ ] Auto-topic tagging: keyword map + source default topics
- [ ] APScheduler setup in FastAPI: RSS poll job every 6 hours
- [ ] `POST /api/ingest/url` endpoint: submit URL → returns draft article metadata
- [ ] "Submit URL" UI on browse page (floating button)
- [ ] Admin: `/settings/sources` shows last ingested timestamp, article count per source
- [ ] Manual trigger: `POST /api/admin/ingest/{source_id}`

**Done when**: RSS jobs run on schedule; new articles appear automatically; can submit a URL and it creates an article.

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

---

*This document is the authoritative source of truth. Update it as decisions are made, phases complete, or scope changes.*
