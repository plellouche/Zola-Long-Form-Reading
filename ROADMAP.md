# Longform — Forward Roadmap (Phase 11 onward)

> Companion to `COMMAND_CENTER.md` and `PHASE_10_POLISH.md`. Phases 0–8 shipped the web MVP; Phase 10 added the discovery deck + profile depth + polish. This document is the **future-state plan** that goes beyond §16's small-item backlog — these are big initiatives worth their own phase docs when picked up.
>
> Items are ordered by the typical sequence in which they become valuable. Each entry includes scope, motivation, dependencies, and the trigger that should pull it off the backlog.

---

## Phase 11 — Username + Password Auth (Production-ready Sign-in)

**Goal**: Replace the OTP-only flow with a durable username/password sign-in so users don't get logged out between sessions and don't depend on Supabase's email delivery for every login.

**Why now**: OTP/magic-link is fragile in dev (rate limits, SMTP misconfig) and adds friction for returning users in prod. Username/password is what people expect for a content app. Magic-link should remain as a fallback for password reset.

### Scope
- `/login`: add a password field; call `supabase.auth.signInWithPassword({ email, password })`. Keep OTP as a fallback ("Sign in with email code").
- `/signup` (new): collect email + password (min 12 chars, basic strength feedback), call `supabase.auth.signUp`, redirect to `/onboarding`. Username picking already happens in onboarding.
- `/forgot-password` (new): send a reset email via Supabase `resetPasswordForEmail`; landing page `/auth/reset-password` accepts new password.
- `/settings`: add a "Change password" section requiring current-password confirmation.
- Persistent sessions: configure Supabase to issue long-lived refresh tokens (default 30 days is fine); document the trade-off in `PROGRESS.md`.
- `/dev/sign-in-as` stays as the local dev fast-path — no email round-trip ever needed.
- Optional: rate-limit `/login` failed attempts at the FastAPI side (`events` table + a 5-fails-in-15min check). Defer until abuse appears.

### Dependencies
- Supabase project Auth settings: enable Email + Password provider, disable confirm-email-required if we want frictionless signup, or wire the confirmation flow if we want it.
- Email provider (Resend) already configured for invites; reuse for password-reset emails.

### Pre-work
- Audit every place we currently assume OTP — the magic-link callback at `/auth/callback`, the URL-fragment handler in `auth-fragment-handler.tsx`. Keep them functional for reset flows, but they're no longer the primary path.

### Trigger to start
- The user (you) is tired of OTP in dev (already true), OR you invite the first non-dev person and they bounce off the OTP flow. Either gates this work to Phase 11 as the **immediate next phase**.

**Estimate**: ~1 day of focused work.

---

## Phase 12 — Production Deployment

**Goal**: Get the app onto real URLs so it can be shared.

**Why now**: The app is feature-complete enough for invitees. Deployment is the bottleneck between "this works on my Mac" and "this is a product."

### Architecture
| Component | Host | Domain |
|---|---|---|
| Frontend (Next.js) | Vercel | `longform.app` (or chosen custom domain) |
| Backend (FastAPI) | Render (or Fly.io) | `api.longform.app` |
| DB + Auth + Storage | Supabase | managed |
| Ingestion cron | GitHub Actions (already wired) | n/a |

### Tasks
1. **Domain**: purchase / configure a domain. Set Vercel + Render DNS.
2. **Vercel project**: import from GitHub, add env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`). Auto-deploy on `main` push.
3. **Render service** for FastAPI: Dockerfile or native Python; env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `DATABASE_URL`, `RESEND_API_KEY`). Health-check endpoint `/healthz` already exists.
4. **Supabase Auth config**: update Site URL + Redirect URLs to include production domain. Without this, magic links / password resets land at `localhost`.
5. **CORS**: tighten `services/api/app/main.py` `allow_origins` to `["https://longform.app"]` (currently `["http://localhost:3000"]` only — production will fail).
6. **GH Actions secrets**: move ingestion `DATABASE_URL` from local `.env` to Actions secrets.
7. **Cold-start mitigation**: Render free tier sleeps after 15min idle. Either pay $7/mo for always-on, or accept the 30s wake-up on first request. Document the trade-off.
8. **Pre-launch smoke test**: sign up fresh account → onboard → save → list → discover → follow → all on production URLs.

### Dependencies
- Phase 11 (auth) should ship first — production OTP rate limits are restrictive on the free tier.
- A real domain name.

### Trigger to start
- Phase 11 lands AND you're ready to invite at least 1 non-yourself person.

**Estimate**: 1 day end-to-end, plus a week of low-level fix-and-redeploy as production surfaces edge cases.

---

## Phase 13 — Public Marketing Home + Signup Flow

**Goal**: When a brand-new visitor lands on `longform.app`, give them a reason to sign up.

**Why now**: Right now `/` either gates to `/login` (signed-out) or shows the For-You feed (signed-in). There's no marketing surface. Once we have a public URL, anyone landing without an invite link sees a barren login form.

### Scope
- **`/` (public)**: replace the current empty signed-out state with a real landing page:
  - Hero: one-line value prop + tasteful screenshot (or interactive mockup of the discovery deck — that's the strongest "feel different" demo).
  - Three-card explainer: Discover → Save → Share lists.
  - Social proof: scrolling band of source logos (Aeon, Longreads, Nautilus, etc.).
  - "Sign up" + "Sign in" CTAs.
- **`/about`** (new): mission, content policy (REDIRECT_ONLY, respect for source), team / about the operator. Plain prose.
- **`/sources`** (new — distinct from the admin `/settings/sources`): public list of all 11 curated sources with one-paragraph descriptions.
- **`/signup`** (lands users into onboarding, ties into Phase 11)
- **Invite-only mode**: add a setting (env var or `app_config` row) that switches `/signup` between "anyone can sign up" and "invite required". Default to invite-required until ready for general availability.
- **Marketing copy**: write 5–10 lines of clear copy. The current site has none.

### Design references to study
- Pocket, Instapaper (the legacy read-later space)
- Are.na (curated discovery aesthetic)
- Substack's home (clean signup-first design)

### Dependencies
- Phase 12 (deployment) — no public home page matters without a public URL.

### Trigger to start
- Phase 12 lands AND you want to move from invite-only to discoverable.

**Estimate**: 2–3 days (writing > coding here; the components are simple).

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

## Phase 17 — Observability, Monitoring, and Scale Prep

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
```

The minimal path to "publicly invitable" is **11 → 12 → 13**. Everything else is upside on top.

---

## What's NOT in this roadmap (and why)

- **Recommender ML upgrades** (embeddings, pgvector, ANN): already documented in COMMAND_CENTER §15, gated on article-count thresholds.
- **Monetization** (paid tier, ads, affiliate): deliberately deferred until product-market fit signal exists. Free invite-only stays the model through Phase 13.
- **Federation / ActivityPub**: cool idea, wrong app shape. We point to sources, not host content.
- **Cross-source dedup**: see COMMAND_CENTER §16 — too rare to be worth fuzzy-matching.
- **Comments**: same — wrong app shape.

---

*Last updated: Phase 10. Review when starting Phase 11 to refresh estimates and triggers.*
