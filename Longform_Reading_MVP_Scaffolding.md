# Longform Reading Webapp MVP --- Scaffolding + Build Instructions (for Claude Code)

## 0) Product summary

Build a "Pinterest-for-longform-reading" webapp that helps a small group
(you + friends) discover, save, organize, and share high-quality
longform articles. Core differentiators:

-   High-signal library (quality gates; curated sources and/or
    nominations)
-   Reading lists (playlists) + social following (see others' lists)
-   Recommendation engine as the center of gravity:
    -   Personalized "For You" feed (Pinterest-style)
    -   Curated recs for each user-created list

Primary constraint: do not infringe copyright. Prefer link-out and
metadata storage. Only display full text when you have rights or it's
explicitly allowed.

------------------------------------------------------------------------

## 1) Non-goals (MVP)

Keep the MVP intentionally narrow:

-   No public marketplace, no creator tools, no writing/publishing
-   No "perfect" ML recsys on day 1
-   No paywall bypassing, no full-text scraping of copyrighted content
    unless explicitly licensed/allowed


------------------------------------------------------------------------

## 2) MVP user stories (scope)

### Discovery

-   Browse a library of articles organized by topics/tags
-   Search and filter (topic, source, length, date, popularity)

### Reading workflow

-   Open article detail: title, author, publication, reading time
    estimate, tags, quality notes, and link to original
-   "Read in app" is optional and should default to:
    -   In-app reader only for allowed content
    -   Otherwise: clean outbound redirect + track click/open event

### Personal organization

-   Login + profile
-   Reading history (opened, finished, time spent proxy)
-   Save for later
-   Create reading lists ("playlists")
-   Add/remove/reorder articles in a list

### Social

-   Follow other users
-   View their profiles + public lists
-   Copy (fork) a list into your own

### Recommendations (MVP version)

-   "For You" feed (ranked)
-   "Because you liked/saved X" related recs
-   "Recommendations for List Y" (help fill a list)

------------------------------------------------------------------------

## 3) Copyright + sourcing rules (design constraints)

Default stance: store metadata and links; do not store/display full text
unless you have permission.

Implement a ContentPolicy per source/article:

-   REDIRECT_ONLY (metadata + link-out; no full text stored)
-   EMBED_ALLOWED (embed via official embed/iframe if provided/allowed)
-   FULLTEXT_ALLOWED (store and display full text; must be explicitly
    permitted)

Safe MVP approach: - Ingest only: - Sources with permissive terms / RSS
that provides full content (rare), OR - Metadata-only via
RSS/OpenGraph + link-out - Provide a "Submit URL" feature that creates
an entry by fetching: - OpenGraph tags (title, image, description) -
Canonical URL - Author/date if available - Do not build a generic
full-HTML scraper that reconstructs paid/premium text. - Respect
robots.txt for any crawling. - Store source-level notes: "Allowed
ingestion method: RSS metadata-only".

------------------------------------------------------------------------

## 4) Recommended architecture (Claude can choose stack)

You want a basic webapp with a strong rec core. Here are viable MVP
stack options; Claude should pick one based on speed + maintainability:


-   Frontend: simple React/Vite
-   Backend: Python, FastAPI
-   DB: Postgres + SQLAlchemy - Perhabs supabase?
-   Auth: external provider or custom JWT/session. Should be a free solution


------------------------------------------------------------------------

## 5) Data model (minimum viable)

### Entities

User\
Source\
Topic\
Article\
ArticleTopic (M:N)\
UserArticleState\
List\
ListItem\
Follow\
Event

(Include fields as previously defined in planning.)

------------------------------------------------------------------------

## 6) Ingestion pipeline (MVP)

Input methods: 1) Manual "Add source" 2) Cron ingestion via RSS 3)
Submit URL (OpenGraph metadata)

Quality gates: - Allowlist strong sources initially - Store source-level
trust score for ranking priors

------------------------------------------------------------------------

## 7) Recommendation engine (MVP strategy)

Start hybrid and simple.

Signals: - Topic overlap - Saves/finishes - Social boost - Freshness
decay - Source trust prior - Penalties for dismissed/finished

Add diversity constraints: - Limit per source - Ensure topic spread

List-based recs: - Compute topic profile of list - Recommend
high-similarity + complementary articles

------------------------------------------------------------------------

## 8) UX / UI (MVP)

Core routes: - / (For You) - /topics/:slug - /article/:id - /read/:id -
/lists - /list/:id - /u/:username - /settings/sources

Card design: - Title - Source - Author - Read time - Tags - Save / Add
to list / Dismiss actions

------------------------------------------------------------------------

## 9) Development plan (phased)

Phase 1: - Auth - Articles CRUD - Topics - Save/finish events - Lists -
Basic For You feed

Phase 2: - RSS ingestion - Follow graph - Trending + social boost -
Diversity constraints

Phase 3: - Trust scoring - Moderation tools - List recommendations -
Notifications (optional)

------------------------------------------------------------------------

## 10) Repo scaffolding

apps/web/\
packages/shared/\
packages/recs/\
packages/ingest/\
infra/\
docs/

------------------------------------------------------------------------


## 12) What "done" looks like

-   Invite small friend group
-   Save, list, follow workflows functional
-   Feed feels coherent (not random)
-   Fresh content ingested
-   No copyright violations

------------------------------------------------------------------------


## 13 Sources of long form articles

- Reddit r/longform, r/longreads
- Aeon
- This directory of 1000 long form articles: https://tetw.org/menu2
- Respected long form bloggers like Matt Levine, Paul Graham and Austin Vernon
- Lattitude media
- 3 quarks daily
- The conversation
- Longreads
- Nautilus
- The paris review
- Orion magazine
- The cut
- Literary hub
- Epic magazine
- Guernica
- jSTOR daily
- Harper's magazine
- Longform
- Pacific Standard
- Propublica
- Free articles made available by nat geo, the atlantic, the economist, the new yorker, the new york times
- The dissolve
- The rumpus
- Collectors weekly
- Narrative.ly
- Grist magazine
- The new inquiry
- The sunday long read
- Wired magazine


## 14 - Supabase credentials

Real values live in the gitignored `.env` file at the repo root (see `.env.example` for required keys). Project URL: `https://rkyephzcumidqnhqmhfw.supabase.co`.

