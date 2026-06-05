# Longform — Forward Roadmap (Phase 11 onward)

> Companion to `COMMAND_CENTER.md` and `PHASE_10_POLISH.md`. Phases 0–8 shipped the web MVP; Phase 10 added the discovery deck + profile depth + polish. This document is the **future-state plan** that goes beyond §16's small-item backlog — these are big initiatives worth their own phase docs when picked up.
>
> Items are ordered by the typical sequence in which they become valuable. Each entry includes scope, motivation, dependencies, and the trigger that should pull it off the backlog.

---

## Phase 11 — Email + Password Auth ✅

**Status (2026-05-23)**: shipped. Detailed implementation notes in `PROGRESS.md` § "Phase 11 — Email + Password Auth"; plan + decisions log in `PHASE_11_AUTH.md`.

**Goal (delivered)**: Replace OTP-only sign-in with email + password as the primary flow. OTP / magic-link kept as a fallback (`/login` → "Use email code instead" toggle) for two reasons: pre-Phase-11 accounts that never set a password can still bootstrap, and corporate-inbox cases where password emails are unreliable.

**What shipped**:
- `/signup` (new) with `zxcvbn-ts` strength meter, min 12-char password, no character-class rules.
- `/login` rewritten — password primary, OTP code behind toggle.
- `/forgot-password` + `/auth/reset-password` (Supabase `resetPasswordForEmail` round-trip).
- "Change password" section on `/settings` (verifies current via a sign-in round-trip since Supabase has no dedicated verify endpoint).
- Anti-enumeration error copy on `/login` and `/forgot-password`.
- Email confirmation disabled on Supabase for the invite-only beta.
- **Proofpoint URL-prefetch workaround** in `apps/web/middleware.ts` — catches `/?code=<uuid>` at the apex and forwards to `/auth/callback?next=/auth/reset-password`. Lets the click-the-link password-reset flow work even on UMich / corporate inboxes whose email scanners would otherwise consume the one-time token. Details: `DEPLOYMENT.md` § Known Gotchas.
- **Resend custom SMTP** for all Supabase Auth emails — domain `zolalongform.com` verified at Resend, sender `noreply@zolalongform.com` ("Zola Longform"). Fixes the prior spam-folder + Gmail-no-delivery issues. Operational details: `DEPLOYMENT.md` § Email delivery via Resend.

**Verification**: end-to-end signup → onboarding → save → discover → sign out → forgot-password → click email link → set new password → sign in confirmed working on `https://zolalongform.com` (2026-05-24).

**Deferred to Phase 11.5**: OAuth providers (Google / GitHub). Reasoning: account-linking edge cases are easier to address after email/password is shipped. Trigger to start 11.5: ≥1 invitee says they'd rather sign in with Google, or you want to reduce friction for a public launch (Phase 13).

**Existing-user migration note**: OTP-era accounts have no password set. They need to run "Forgot password" once (or use the legacy OTP code option) before they can sign in with a password. Send a one-line heads-up to anyone in that bucket.

---

## Phase 12 — Production Deployment ✅

**Status (2026-05-24)**: shipped. Production live at `zolalongform.com` + `api.zolalongform.com`. Phase 11 also shipped alongside. Operational details + carry-forward TODOs live in `DEPLOYMENT.md`; this section is the historical plan.

### Architecture (as deployed)
| Component | Host | Domain |
|---|---|---|
| Frontend (Next.js) | Vercel | `zolalongform.com` — HTTPS via Let's Encrypt |
| Backend (FastAPI) | Render (free tier) | `api.zolalongform.com` — HTTPS via Let's Encrypt |
| DB + Auth + Storage | Supabase | managed |
| Auth email | Resend custom SMTP | sender `noreply@zolalongform.com` |
| Ingestion cron | GitHub Actions | n/a |
| Keep-Render-awake | GitHub Actions (every 10 min) | n/a |

### What shipped
- Vercel project `zola` (Root Directory `apps/web`, framework auto-detect, pnpm workspace install). Production env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL=https://api.zolalongform.com`.
- Render service `zola-api` via blueprint (`render.yaml` at the repo root). Python 3.12 native runtime; installs `requirements.txt` + workspace `packages/ingest`; uvicorn on `$PORT`; `/healthz` as health check; auto-deploys on push to `main`.
- Supabase Auth: Site URL + Redirect URLs include the production domain. Email confirmation disabled (invite-only).
- FastAPI CORS expanded to allow production + preview-deploy patterns.
- Supabase Session pooler URL used for `DATABASE_URL` on Render (IPv4 path; the direct Supabase URL is IPv6-only and Render is IPv4-only). Documented in `DEPLOYMENT.md` Known Gotchas.
- Custom domain `zolalongform.com` (apex + www via Vercel, `api` subdomain via Render) on GoDaddy DNS.
- Resend custom SMTP for all auth emails — domain verified, sender `noreply@zolalongform.com`.
- GH Actions: ingestion cron secrets already in place; `RENDER_API_URL` secret set for the keep-awake workflow.
- End-to-end smoke test on production confirmed: signup → onboarding → save → discover → sign out → forgot-password → reset → sign in.

### Carry-forward TODOs (full details in `DEPLOYMENT.md`)
- **Vercel GitHub auto-deploy** is not connected — every Vercel deploy is currently `npx vercel --prod --yes`.
- **Vercel Preview env vars** not set — PR-preview deploys would break at runtime.
- **Render free → Starter ($7/mo)** when the keep-awake hack becomes insufficient or cold-start latency hurts.
- **Separate Supabase project for previews** if PR previews land.
- **Sentry / error tracking** at Phase 17 trigger.

---

## Phase 13 — Public Marketing Home + Signup Flow ✅

**Status (2026-05-24)**: shipped. Implementation notes in `PROGRESS.md` § "Phase 13 — Public Landing Page"; plan + decisions log in `PHASE_13_LANDING.md`.

**What shipped**:
- `/` (signed-out) replaced with a real landing page: `<LandingHero>` (wordmark + tagline + CTAs), `<ProductExplainer>` (Discover / Save / Share three-card grid), `<SourceBand>` (CSS marquee of source names, paused on hover, reduced-motion respected), and a closing CTA card.
- `/about` (new): ~400-word first-person essay on what Zola is, what it isn't, content policy, who's behind it.
- `/sources` (new, public): grid of all active sources sorted by article count.
- `/signup` gated by `NEXT_PUBLIC_INVITE_REQUIRED=true` + server-only `ZOLA_INVITE_CODES`. Codes are doormat security for the invite-only beta.
- Nav-bar updates: signed-out viewers see "Sources" + "About" alongside "Browse".

**Deferred / carry-forward**:
- Per-source hand-written descriptions (`sources.public_description` column + ~50 words per source) — ~2 hrs of writing. Lands after first invite cohort feedback.
- OG image for `zolalongform.com` — Phase 14 polish.
- Vercel env vars `NEXT_PUBLIC_INVITE_REQUIRED=true` + `ZOLA_INVITE_CODES=…` to set on Production before next deploy.

---

## Phase 14 — UI Refinement + Custom Themes

**Goal**: Move from "shadcn defaults work" to a distinctive visual identity.

**Why now**: Polish-without-personality looks generic. Once the app is live, the visual brand becomes part of why people share it.

### Scope
- **Custom color palette**: pick a real brand palette (not just neutral grays + black). Likely a warm-paper light theme + a muted-ink dark theme. Define `--primary`, `--accent`, `--card` CSS variables (the deck already needed `--card`; this is the place to actually define it).
- **Typography**: switch from system fonts to a curated pair — likely a contemporary serif for headlines (e.g. Source Serif, Newsreader, Tiempos) and a clean sans for UI. Self-host via `next/font` to avoid Google Fonts CLS.
- **Theme picker in settings**: more than light/dark — let users choose from 3–4 named themes ("Paper", "Ink", "Sepia", "Slate"). Stored in `profiles.ui_prefs jsonb` or localStorage.
- **Card density toggle** (deferred from Phase 10) — fits naturally here.
- **Iconography pass**: replace lucide-react where it feels generic; consider custom-drawn icons for the major nav items (Discover, Browse, Lists).
- **Empty-state illustrations**: the current `<EmptyState>` accepts an icon but most surfaces leave it blank. Commission or AI-generate a small consistent set.
- **Subtle texture**: the current background is flat white/black. A faint noise texture or off-white shift differentiates from every other Tailwind site.
- **Animation pass**: page-transition micro-motion (Next 15 supports view transitions), button feedback, card stagger on first load.

### Dependencies
- Phase 12 (production) so refinements show on the live site.
- Some user feedback (Phase 13) so we know which surfaces are actually load-bearing.

### Trigger to start
- After Phase 13, when there's user feedback to inform what to polish further. Or sooner if you want a portfolio piece that looks distinct.

**Estimate**: 1 week, easily 2 if iterating on design with a fresh eye.

---

## Phase 15 — Inline Articles (`FULLTEXT_ALLOWED`)

**Goal**: For sources that grant permission, render the article inline at `/read/[id]` instead of bouncing to the source URL.

**Why now (probably later)**: This is the single biggest UX leap available — a Pocket/Instapaper-like reading experience would transform engagement. But it's gated by legal terms with each source and a non-trivial ingestion + rendering upgrade.

### Legal pre-work (DO FIRST)
This phase is **blocked on explicit per-source licensing**. Before any code:
1. **Identify candidate sources**: which of the 11 seed sources publish under licenses that allow full-text rehosting? Most don't by default — even the Creative Commons sources (Aeon, sometimes Public Books) carry attribution / non-commercial / no-derivatives clauses worth reading carefully.
2. **Reach out to publishers**: a small list of curated sources may grant permission for an explicit, attributable reader experience that links back. Frame it as "a Pocket-like reading mode that drives traffic and saves." Some will say yes. Most will say "send a deal memo."
3. **Document the agreement** per source: which articles count, attribution requirements, removal-on-request SLA, whether ads or affiliate links are permitted. Store as text/markdown in `infra/legal/<source>.md`.
4. **Update `sources.content_policy`** per source. The DB column already supports `FULLTEXT_ALLOWED` — currently zero rows have it.

### Engineering scope (only after legal)
- **Ingestion upgrade**: `packages/ingest` learns to fetch the full body for `FULLTEXT_ALLOWED` sources. Use `readability-lxml` or similar to extract main content. Store in `articles.full_text` (column exists).
- **`/read/[id]` route**: typography-focused reader. Tailwind Typography plugin (`@tailwindcss/typography`) + max-w-prose. Font size control, line-height control.
- **Save reading progress**: client-side beacon on `visibilitychange` + scroll position. Already-planned `user_article_states.time_spent_seconds` column gets populated.
- **Mark-as-finished CTA**: prominent at the end of the article, with optional "share" / "add to list" affordances.
- **"Read in app" vs "Read on {source}"**: ArticleCard learns to surface the in-app option when the policy permits.
- **Attribution UI**: every reader page must visibly link to the source and show their byline / publication date prominently. Honor the contract.
- **Honor takedown requests**: a quick admin path to flip an article (or all from a source) back to `REDIRECT_ONLY`.

### Risks
- **Copyright complaint = product death-stroke**. The legal foundation matters more than the feature.
- Subset of sources opting in could create a weird two-tier UX. Consider whether to push the in-app reader hard, or treat it as an enhancement to certain articles only.

### Dependencies
- Phase 11 + 12 (auth + production) — need a real product to negotiate with.
- Some user evidence that read-in-app is wanted (saves vs link-clicks ratio).

### Trigger to start
- You have at least 50 active users AND 1+ sources have given written permission.

**Estimate**: legal pre-work is open-ended (weeks of email); engineering is ~1 week once legal is settled.

---

## Phase 16 — Native Mobile App (App Store + Play Store)

**Goal**: Ship `apps/mobile` as an Expo React Native app, publishable to both stores.

**Why now (long term)**: The reading experience is fundamentally a mobile use case. The swipe deck *especially* belongs on a phone. The monorepo was architected on day one to absorb mobile without restructuring — `packages/shared` (TS types) and `packages/api-client` (typed fetch) work cross-platform.

### Scope
- **Scaffold `apps/mobile`** with Expo SDK 51+ + React Native + TypeScript. Already a placeholder in COMMAND_CENTER §3.
- **Wire `packages/api-client`** — already platform-agnostic. Pass a token getter that reads from `expo-secure-store`.
- **Core screens**: Home (For-You), Discover (swipe deck — finally on a touchscreen where it belongs), Browse, Article Detail, Lists, Profile, Settings.
- **Auth in Expo**: `supabase-js` works in React Native; `expo-auth-session` for OAuth providers. Username/password from Phase 11 covers most of it.
- **Push notifications** (Expo Notifications): list activity, follow notifications, "new article from @user you follow". Use Supabase's `push_subscriptions` (new table) keyed by user.
- **Offline reading**: for `FULLTEXT_ALLOWED` content from Phase 15, cache locally with WatermelonDB or simple AsyncStorage. Sync read-progress on reconnect.
- **App Store + Play Store submission**:
  - Apple Developer account ($99/yr) + Google Play account ($25 one-time).
  - App Store Connect: create the listing, write copy, prepare screenshots (5–8 per device class), record a preview video.
  - Privacy policy + terms of service (required by both stores) — host at `/privacy` and `/terms` on the web.
  - **App Review traps**:
    - Apple is hostile to apps that "just open a website" — the in-app reader (Phase 15) is the strongest defense here.
    - REDIRECT_ONLY articles are okay but the app must demonstrate native value (the deck, lists, social, recs).
    - In-app purchases: if monetization ever lands, Apple takes 30% — design with this in mind.
- **CI**: EAS Build for both platforms; submission automation via EAS Submit.

### Dependencies
- Phase 11 (auth) — can't ship a mobile app with OTP-only.
- Phase 12 (production API) — mobile needs a stable production endpoint.
- Phase 15 (in-app reader) is strongly recommended before submitting to Apple — without it, App Review may reject as "just a web shell".

### Trigger to start
- Web app has ≥ 100 active users AND Phase 15 has at least a few `FULLTEXT_ALLOWED` sources, OR you decide mobile-first is the right product bet and accept the App Review risk.

**Estimate**: 4–6 weeks first-time; ongoing maintenance ~10% of dev time once shipped.

---

## Phase 17 — Observability, Monitoring, and Scale Prep (light variant ✅, full variant pending)

**Status (2026-06-04)**: Phase 17 *light* is shipped (Sentry on both ends, in-house `/admin/dashboard` with Plotly, opt-in `/users` directory, monitoring runbook in `DEPLOYMENT.md`). Full variant (alerting + UptimeRobot + structured logging + scale-tier triggers) waits for the user-count threshold below.

**Goal**: Know what's happening in production before users tell you. Scale Supabase / Auth / API capacity on actual signal.

**Why now (long term)**: Premature monitoring is a tax. Real monitoring becomes valuable when you have ≥ 50 daily active users and downtime is felt by more than you.

### Scope by surface

**Application errors**
- **Sentry** on the Next.js frontend (`@sentry/nextjs`). Root `error.tsx` currently just `console.error`s — pipe it.
- **Sentry on FastAPI** (`sentry-sdk[fastapi]`). Group by route + user.
- Set up alerts: P0 (error rate > 1%) → email + (later) PagerDuty.

**Performance**
- **Vercel Analytics** + **Speed Insights** (frontend). Tracks core web vitals automatically. Free at low volume.
- **Render metrics** for backend CPU / memory / response time.
- **Supabase metrics**: query performance, connection pool usage, storage growth. Free tier already has this; just check it weekly.

**Product analytics**
- The `events` table is the proto-analytics — we already log SAVE, FINISH, DISMISS, LINK_CLICK, SWIPE_*, FOLLOW. Build a small `/admin/dashboard` that surfaces: DAU/WAU/MAU, save-rate per article, follow growth, deck completion rate.
- Optionally: PostHog or Plausible if a third-party dashboard becomes more useful than rolling our own. PostHog is great but heavyweight; Plausible is light and EU-friendly.

**Logging**
- **Structured logs** on FastAPI (`structlog` or just `logging` with a JSON formatter). Render captures stdout already; piping to a log aggregator (Better Stack, Logtail) becomes worth it at scale.

**Uptime**
- A simple **uptime monitor** (UptimeRobot free tier, or BetterStack) pinging `/healthz` every 5 min. Get an email when it goes red.

### Supabase scaling triggers
Documented in `COMMAND_CENTER.md §15` already. Brief recap with monitoring focus:
- **DB CPU > 50% sustained** → upgrade to next Supabase tier. Add read replicas if needed.
- **Storage approaching limit** → review what's in the `avatars` bucket; consider migrating to Supabase Storage tiered pricing.
- **Auth users > 50k** → still well within Supabase Pro; revisit at 500k.
- **Egress > 250GB/mo** → enable Vercel/CDN caching aggressively on public article pages.

### Cost-conscious operation
- Pre-revenue: free tiers everywhere (Vercel Hobby, Render Free, Supabase Free + Pro). Estimate $0–25/mo.
- 100 users: should still fit free tiers comfortably.
- 1000 users: Supabase Pro ($25/mo), Render Starter ($7/mo), Vercel Pro if egress matters. Estimate ~$100/mo.
- 10,000 users: real costs kick in. Plan an upgrade path that doesn't require rearchitecting.

### Dependencies
- Phase 12 (need production to monitor)
- Some users (need signal worth measuring)

### Trigger to start
- ≥ 50 DAU OR a user-facing incident that you didn't catch in time. Light setup (uptime monitor + Sentry) should land at Phase 12 anyway as a baseline.

**Estimate**: 1 day for the lightweight setup at Phase 12; 1 week for the full dashboard + alerting at the scale-trigger.

---

## Phase 17.5 — PostHog (future expansion)

**Goal**: Real product analytics — funnels, retention curves, A/B tests, session replay — once the in-house `/admin/dashboard` runs out of road.

**Why now (deferred)**: Today's `/admin/dashboard` covers signups, DAU/WAU/MAU, finishes, save→finish conversion, top articles + sources from our own `events` table. That's enough for a beta. PostHog earns its keep when you start asking questions the in-house dashboard can't answer cheaply.

### Trigger to add PostHog
Any one of these:
- ≥50 daily active users and you want to A/B test a UI change
- Need a real funnel view (signup → onboarding → first save → first finish drop-off)
- Want session replay to debug "why do users bounce on /discover after one card?"
- Need cohort analysis ("week-1 retention for users who saved ≥3 articles in their first session")

### Why PostHog specifically
- Generous free tier: 1M events/month, 5k session replays/month (we'd use <10k/month at beta scale)
- Self-hostable if the privacy story matters more later
- Built-in dashboards + funnels + cohorts (no SQL needed for common questions)
- Feature flags + A/B testing built in (no separate vendor)
- Plays well with Next.js — `posthog-js` autocapture covers most events with zero tagging

### Privacy tradeoff
Adds a third-party tracker that sees every page navigation. Long-form readers tend to dislike trackers. Three mitigations:
- Self-host PostHog (free, ~$10/mo on a small VPS)
- Use PostHog EU cloud + opt-in cookie banner
- Defer until churn signal forces the question

### Implementation sketch (when triggered)
- `pnpm add posthog-js posthog-node` in `apps/web`
- Wrap `app/layout.tsx` in a `<PostHogProvider>` client component
- `posthog.identify(user.id)` after login
- Tag manually-tracked events alongside our existing `events` writes:
  ```ts
  posthog.capture('article_finished', { article_id, source_slug });
  ```
- Server-side capture from FastAPI for ingest pipeline runs (cron health metric)
- Set `NEXT_PUBLIC_POSTHOG_KEY` in Vercel
- Build first funnel: `Sign up → Onboard → First Save → First Finish`

**Estimate**: ~half day to install + tag the top 10 events. Funnels and dashboards configurable in PostHog UI, no code.

---

## Phase 18 — Search & Recommender Improvements (first slice ✅, polish + saved searches pending)

**Status (2026-06-04)**: First slice shipped — pgvector enabled, `articles.embedding vector(384)` column live, GHA cron embedding 500 articles per tick (~72% backfilled at last check), recs feeds blend `dense_cosine(user_emb, article_emb) * 0.7 + topic_cosine * 0.3` when both sides are embedded (falls back gracefully during cold start), `/api/search?mode=hybrid` interleaves keyword + semantic results (behind `SEMANTIC_SEARCH_ENABLED` flag since the model is RAM-tight on Render free tier). Still on the roadmap: HNSW index when article count crosses 10k, saved-search digests, A/B harness, autocomplete.

**Goal**: Move beyond keyword tagging + sparse-dict cosine to a recommender that actually understands what an article is about, and a search that handles synonyms and conceptual queries — not just exact text matches.

**Why now (medium-term)**: The current stack does ~80% of the work for ~5% of the effort. Once we have ~50k articles and real engagement signal, the ceiling becomes painfully visible: a user who saves five climbing essays still gets generic "popular" articles surfaced, and a search for "epistemology of science" misses every article that talks about *how we know* without using that exact phrase. The schema was designed from day one to absorb these upgrades without restructuring (`articles.search_tsv`, `article_topics.weight`, `events`).

### Two parallel tracks

#### A. Recommender quality

**Sentence embeddings instead of keyword topic vectors.**
- Move `packages/recs/profile.py` from `{topic_id: weight}` dicts to dense vectors. One embedding per article (computed at ingest time, stored in a new `articles.embedding pgvector(384)` column).
- Use a small, locally-runnable model: `sentence-transformers/all-MiniLM-L6-v2` (384-dim, ~80MB, runs on CPU in <50ms per article). Avoid OpenAI/Anthropic embeddings until the cost matters.
- Migration: `pgvector` extension on Supabase, `alter table articles add column embedding vector(384)`, backfill job in `packages/ingest`.
- HNSW index when article count > ~10k: `create index on articles using hnsw (embedding vector_cosine_ops)`.
- User profile becomes the centroid of their saved/finished article embeddings (with the same status weights as today).
- `for_you_feed`, `for_discover_deck`, `related_articles` swap cosine-similarity-over-topic-dicts for cosine-similarity-over-embeddings. The function signatures stay the same; only the math changes.

**Hybrid ranking** (keyword + embedding + behavioral).
- Keyword topic match still adds a small bonus (matches user intent when they pick a topic explicitly).
- Embedding similarity is the workhorse.
- Behavioral signals (save_count, finish_count, social_count) layer on as today.
- Re-tune the weights empirically once we have engagement data — currently they're hand-picked.

**Cold-start improvements**.
- New users: weight onboarding topic picks more heavily until they have ≥5 saves; gradually phase in implicit signal.
- New articles (no save_count yet): apply a freshness boost + source_trust prior. Already partially done.

**Per-user score precomputation** at scale.
- At ~1k users + ~10k articles, scoring on every `/api/feed` request becomes expensive. Add a `feed_cache` table (user_id, article_id, score, refreshed_at) refreshed nightly by a job. The route reads from cache and only falls back to live scoring on miss.

#### B. Search quality

**Synonym expansion + conceptual search**.
- Current `/api/search` uses Postgres `websearch_to_tsquery('english', ...)` with `to_tsvector('english', ...)`. Good for stemming ("climbed" → "climb"), bad for synonyms.
- Layer in **embedding search**: convert the query to an embedding, find the 50 nearest articles by cosine, then re-rank with the keyword score. "epistemology of science" finds Aeon essays on "how we know" without either term explicitly matching.
- Falls out naturally from track A — same embedding column, same model.

**Result diversity in search**.
- Apply the same `apply_diversity` logic the recs use: max N per source, prefer covering multiple topics. Stops a single source from dominating common queries.

**Filters that actually compose**.
- Today's `/api/articles` accepts source + topic + reading-time + date filters but the UI exposes them inconsistently. Audit the chip-style filter UI on `/browse`; make filter state shareable via URL (already partially true via query params).

**Search suggestions / autocomplete**.
- Pre-compute the top 500 query terms (from `events` table once we log search queries — currently we don't). Surface as autocomplete in the nav search input.
- Requires: log search queries (new event type `SEARCH`), a rollup job, and a small `/api/search/suggest?q=...` endpoint.

**Saved searches** (queued already in COMMAND_CENTER §16, lands cleanly here).
- A `saved_searches` table; daily/weekly digest email when new matches arrive. Resend is already wired.

### Evaluation

The hard problem is knowing whether changes actually help. Set up a simple A/B harness:
- `experiments` table: user_id, experiment_name, variant, assigned_at.
- Recs and search code paths check the experiment and branch.
- Compare engagement (save rate, deck completion, follow-through to source) between variants over 2 weeks.
- Start simple: just compare "current" vs "embeddings". Don't build a full feature-flag platform — it's premature.

### Dependencies
- Phase 12 (production) — embeddings need to run on the production ingest infra, not just locally.
- Phase 17 (light observability) — need engagement metrics to know if changes help.
- Article volume ≥ ~5k for embedding search to feel different from keyword search. Below that, both work equivalently well.

### Trigger to start
- Article count ≥ 5k AND ≥ 50 active users complaining that the feed feels repetitive or that search misses obvious things. Or sooner if you want a portfolio-worthy ML lift.

**Estimate**: 1 week for the embedding pipeline + recs swap; 1 week for the search upgrade + autocomplete; 1 week for A/B harness + tuning. ~3 weeks end-to-end.

---

## Continuous Track — Source Acquisition

**Not a phase, an ongoing program.** Curation quality is what makes Longform feel different from a generic aggregator. New sources should be added continuously, not in big-bang batches.

### Why it matters more than other "growth" levers
The product's value proposition is "high-signal long-form reading." With 11 seed sources, breadth is limited — a user interested in climate has Latitude Media and that's mostly it. Adding the right 30–50 sources transforms For-You and Discover from "interesting but narrow" to "I keep finding things I'd never have seen."

### Operating model
- **Target cadence**: 1–3 new sources per month, every month. Not 30 at once.
- **Plus the "acquisition push"**: a one-day batch session every quarter (or before a feature launch / friend invite wave) where you add 5–10 vetted sources at once. The fetch-strategy framework (`fetch_strategy: rss|archive|sitemap|manual`, see PROGRESS.md "Fetch strategies & full-archive backfill") makes this practical — sources without RSS or with thin RSS feeds are now ingestable via `archive` or `sitemap` strategy + a per-source word-count floor.
- **Quality bar over completeness**. A "longform-only" filter is the brand promise. No daily-news outlets, no Twitter aggregators, no clickbait. Articles should average ≥ 1,500 words and ≥ 10-minute reads.
- **Diversity of perspective and topic**. Audit the source list quarterly for blind spots: where are the literary sources? The science-writing sources? The voices outside the US/UK?
- **Owner accountability**: someone (initially you) reviews each candidate against a written rubric. Don't outsource curation to "popularity" — that's how every aggregator becomes the same aggregator.

### Source rubric (vet against this before adding)
1. **Format**: long-form essays / reported features / criticism (not news bulletins, not link-blog roundups).
2. **Cadence**: publishes ≥ 1 piece per week on average. Quieter is fine; dead is not.
3. **Editorial independence**: identifiable masthead, named editors, accountable publishing model.
4. **Copyright posture**: RSS feed present and unrestricted; canonical URLs stable; OG metadata clean. Set `content_policy = REDIRECT_ONLY` unless they grant explicit permission for in-app reading (see Phase 15).
5. **Voice / point of view**: brings something distinctive. Five sources that all sound like *The Atlantic* is one source.
6. **Topic coverage**: fills a gap in the current 12 topics. Use the per-source default-topics feature (`source_default_topics`) to bias new articles toward where the source actually publishes.
7. **No ethical concerns**: not state-funded propaganda, not a content farm, not a known SEO-spam outlet.

### Candidate pipeline (suggestions to evaluate)
A working list — not committed. Each needs the rubric check.

- **Essays / criticism**: The Point, n+1, The Baffler, Cabinet, The Yale Review, The Hedgehog Review, The Drift, The Dial, Lapham's Quarterly, Notre Dame Magazine.
- **Long-form journalism**: The Atavist, Texas Monthly Long Reads, ProPublica Long Reads, GQ features, California Sunday, Atlas Obscura long-form.
- **Science writing**: Quanta Magazine, Undark, Hakai Magazine, Knowable Magazine, Asimov Press, Inference Review.
- **Travel / adventure**: The Wayward Daughter, Outside long-form, Patagonia Stories, Roads & Kingdoms, Atlas Obscura.
- **Technology / culture**: Increment (archives), Stratechery (paid — likely declined), The New Atlantis, Real Life Magazine (now-defunct but archive is good), Garbage Day, Anil Dash's blog.
- **History / arts**: Public Domain Review, JSTOR Daily, Smithsonian Magazine long-form, History Today, Cabinet Magazine.
- **International voices**: Granta, Caravan Magazine (India), The Markaz Review (Middle East), The Continent (Africa), Mekong Review, Eurozine.

### Tooling support already in place
- Admin form at `/settings/articles/new` (manual article submission).
- Source list at `/settings/sources` with create form.
- `source_default_topics` table for biasing ingestion-time tagging.
- Ingestion runner picks up new sources automatically once `is_active = true`.

### Tooling to add (low priority)
- **Source-suggestion form for users** (queued in COMMAND_CENTER §16). Currently admin-only. Opening it requires a moderation queue, but it's the most direct way to discover sources you'd never find yourself.
- **Source ingest-history viewer** (queued in §16). Useful for noticing when a source breaks or goes quiet.

### Trigger / cadence
- Continuous, but specifically schedule a **source-acquisition pass quarterly**: 1 day of dedicated time to review the candidate list, vet 3–5 against the rubric, ingest 1–3.
- Also revisit whenever a user complains the feed feels narrow.

### Next push — high-priority candidates
After the fetch-strategy framework landed, the bottleneck is no longer "does this source have a usable RSS feed" but "have we picked the right 10 to deepen this beta." Top of the queue for the next batch, with the strategy I'd use for each:

| Candidate | Why now | Likely strategy |
|---|---|---|
| Quanta Magazine | Best science writing on the internet; perfect topic fit | `sitemap` + `/(physics-news\|biology-news\|computer-science-news\|mathematics-news)/` filter, 1500-word floor |
| The Dial | Global longform, literary, founded 2022 — fills international-perspective gap | `rss` if available, else `sitemap` |
| Lapham's Quarterly | Historical essays, themed quarterly issues | `archive` via their issues index |
| n+1 | Literary criticism + cultural commentary | `rss` (`nplusonemag.com/feed/`) |
| The Drift | Politics + criticism, edited by under-30s | `rss` |
| Hakai Magazine | Science + nature writing, coastal focus | `rss` |
| The Yale Review | Long essays, criticism | `rss` if available |
| The New Atlantis | Tech & society, conservative-leaning to balance the lineup | `rss` |
| Caravan Magazine (India) | International voice, longform reporting | `rss` |
| Public Domain Review | Historical curios, beautiful essays | `rss` (`publicdomainreview.org/feed`) |

Estimated work: ~15 min per source for vetting + config + first ingest run. Whole batch = ~3 hours.

---

## Sequencing recommendation

If you ship this in order, the dependency graph is clean:

```
Phase 11 (auth)  ─┬─→  Phase 12 (deploy)  ─┬─→  Phase 13 (landing)  ─→  Phase 14 (UI polish)
                  │                         │
                  │                         └─→  Phase 17 (light monitoring at deploy)
                  │
                  └────────────────────────→  Phase 15 (inline articles, legal-gated)  ─→  Phase 16 (mobile)
                                                                                          │
                                                                                          └─→  Phase 17 (full observability at scale)
                                                                                          │
                                                                                          └─→  Phase 18 (embeddings + smarter search)

Continuous Track ─→  Source acquisition (quarterly, runs in parallel to everything)
```

The minimal path to "publicly invitable" is **11 → 12 → 13**. Everything else is upside on top. The source-acquisition track runs in parallel through all of it — adding 1–3 high-quality sources per month is the simplest, highest-leverage way to make every other phase land better.

---

## Pending small follow-ups (not phases, but tracked)

These don't warrant their own phase — they're scoped well under a day each — but they're real, live, and worth doing soon. Listed in rough priority order.

### Fix the broken-RSS sources
- **Status**: known broken; currently marked `fetch_strategy = manual` so they don't spam the cron error log.
- **The sources**: Boston Review (RSS feed returns empty channel), The Rumpus (RSS URL is HTML, not RSS), 3 Quarks Daily (DNS resolution fails), Reddit /r/longform (RSS works but each entry is a thread; we'd need to extract the linked article URL from the thread body — non-trivial), Sidetracked, Austin Vernon (no public feed).
- **Effort**: 30–60 min for each of the first few (find the new feed URL or switch to sitemap). Reddit is its own ~1-day project because the data shape is different.
- **Trigger**: any time. The current `manual` config is non-blocking but means zero ingest from these sources.

### OG image for `zolalongform.com`
- **What's missing**: `app/opengraph-image.tsx` was tried twice via `next/og` ImageResponse, both times crashed Satori (woff2 unsupported, Google Fonts returning HTML). Deferred until we generate a static PNG offline.
- **Effort**: 30 min if we generate the PNG locally (sharp / imagemagick / one-shot Node script) and commit it as `apps/web/app/opengraph-image.png`.
- **Trigger**: any time the brand share-card is wanted (Twitter / iMessage / Slack unfurl).

### Render free → Starter upgrade
- **Trigger**: first user complains about the 30s cold start, OR we want to enable semantic-search in production (Render free tier can't fit the sentence-transformers model in 512MB). $7/mo.
- **Side effect**: the keep-Render-awake GH workflow becomes redundant — delete it.

### Activate semantic search in production
- **Status**: code is wired and behind `SEMANTIC_SEARCH_ENABLED`. Needs (a) Render Starter or bigger (RAM), (b) `pip install sentence-transformers` in the API runtime (currently only in the GHA cron's `[embeddings]` extra), (c) `SEMANTIC_SEARCH_ENABLED=true` env var.
- **Trigger**: after the Render upgrade above. Until then, `mode=hybrid|semantic` requests silently fall back to keyword.

### Pairwise Elo → batch Bradley-Terry
- **What's there**: incremental Elo (K=32) on each pairwise comparison, applied atomically with the vote.
- **What's missing**: Bradley-Terry recompute over the full comparison history. Incremental Elo is path-dependent — early votes are noisy.
- **Effort**: half a day. Becomes worth it once a single user has ~50+ comparisons.

### (Already documented elsewhere)
- **Archive + sitemap dedup-before-fetch optimization**: skips ~6000 page-fetches/day at current scale once implemented.
- **HNSW index on `articles.embedding`**: deferred until article count crosses 10k (currently 3,468). One-line migration when ready.
- **Vercel GitHub auto-deploy reconnect**: in DEPLOYMENT.md Carry-forward TODOs.
- **Vercel Preview env vars**: in DEPLOYMENT.md Carry-forward TODOs.

---

## What's NOT in this roadmap (and why)

- **Monetization** (paid tier, ads, affiliate): deliberately deferred until product-market fit signal exists. Free invite-only stays the model through Phase 13.
- **Federation / ActivityPub**: cool idea, wrong app shape. We point to sources, not host content.
- **Cross-source dedup**: see COMMAND_CENTER §16 — too rare to be worth fuzzy-matching.
- ~~**Comments**: same — wrong app shape.~~ **Reconsidered and shipped** (2026-06-04). Flat, signed-in to write, public to read. Auto-linkified URLs, no markdown. See PROGRESS.md § "Gamification: ratings, Elo, leaderboard, comments".

---

*Last updated: 2026-06-04. Phases 11/12/13 fully shipped; Phase 17 light shipped (Sentry both ends + in-house admin dashboard + opt-in user directory); Phase 18 first slice shipped (pgvector + GHA-cron embedding backfill + recs blend + hybrid search behind a flag). Off-roadmap shipped: ratings + Elo + pairwise comparisons + hours leaderboard + comments + mixed-source browse + paywall chips + hand-rendered favicon + 19→46 sources.*
