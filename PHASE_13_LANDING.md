# Phase 13 — Public Landing Page + Signup Flow

> The public face of Zola. Today a signed-out visitor sees a sparse hero with a "Sign in" button — no reason to sign up, no preview of what's inside, no signal of curation depth. Phase 13 fixes this so the site is something you can link a friend to.

## Goal

Turn `https://zolalongform.com` (signed-out state) from "barren login page" into "a thing that makes a literate friend say 'oh, yes — sign me up.'" Specifically:

1. A landing page that explains the product in 10 seconds without screenshots feeling like marketing fluff.
2. Visible signals of curation: the list of sources, a glimpse of recent essays.
3. A clean signup CTA that respects the invite-only stance until you decide to open it up.

Done when: a friend gets a link to `zolalongform.com`, lands on the page, understands within 10 seconds what Zola is, and either signs up (if open) or sees a graceful "invite-only" path (if closed).

---

## 1. Decisions to lock in upfront

Two branch points. I'll default to my pick unless you weigh in.

### 1.1 Invite-only vs open signups

The signup form is wired (`/signup` from Phase 11). Question: when a stranger arrives at `zolalongform.com/signup`, can they create an account?

**Recommendation: invite-only by default, controlled by an env var.**

- Behaviour with invite-only ON: `/signup` shows "Zola is invite-only right now. If you have an invite code, enter it below" — a single text field. The `signUp` call is only made if the code matches a known value. Known codes = an env var `ZOLA_INVITE_CODES` (comma-separated). Crude, but right for a beta.
- Behaviour with invite-only OFF: `/signup` is the form we built in Phase 11. Anyone can sign up.

Why this default: friends get a code directly from you; randoms hitting the URL see an inviting wall, not an open signup that you'd then have to moderate. The code is just a doormat, not real auth (anyone can share a code) — that's fine for invite-only beta semantics.

Implementation cost: ~30 min. One env var read + one extra component state on `/signup`.

### 1.2 What lives at `/` vs `/about` vs `/sources`

I propose:

- `/` (signed-out) — hero + value prop + three-card explainer + source-name band + CTAs.
- `/about` — a one-page personal essay on what Zola is, why it exists, the content policy. Plain prose, no marketing speak.
- `/sources` — public list of active curated sources, each with a one-paragraph description and a link to that source's page on Zola (`/source/[slug]`). This page also functions as the strongest curation-quality argument.
- `/` (signed-in) — unchanged. Still the For-You feed.

The split keeps `/` punchy. Detail goes to subpages for people who care to look.

---

## 2. Scope

### 2.1 New / changed routes

| Route | Treatment |
|---|---|
| `/` | Replace current sparse signed-out hero with full landing page. Signed-in state unchanged. |
| `/about` (new) | Single page; prose essay; one CTA at the bottom ("Sign up" or "Sign in" depending on auth state). |
| `/sources` (new, public) | Public list of all `is_active = true` sources. Each card: name, ~120-char description, article count, "Browse" link to `/source/[slug]`. |
| `/signup` (changes) | Gate on invite-only env var. When ON, show "Invite required" + code input; only proceed to email/password form if code matches. When OFF, behaves as today. |

### 2.2 New copy (write once, real prose)

The whole project lives or dies on whether the copy lands. I'll write a first draft for each surface, then we iterate. Specifically:
- Hero tagline (already exists: "Essays worth your evening.")
- Hero subhead — one sentence that names the use case more concretely.
- Three-card explainer headings + bodies (~20 words each).
- `/about` essay — ~400 words.
- Per-source one-paragraph descriptions for the 27 active sources — pulled from each source's own about page when available; written by hand for the 5–6 that don't have one.

### 2.3 New components

- `<LandingHero>` — wordmark + tagline + subhead + CTA pair.
- `<ProductExplainer>` — three-card grid: Discover / Save / Share.
- `<SourceBand>` — horizontal scrolling row of source names in Spectral, capped at ~12 visible.
- `<SourcesGrid>` — grid layout used on `/sources`; each card is one source with description + article count.

### 2.4 What doesn't change

- All authenticated routes.
- Auth flows (`/signup`, `/login`, `/forgot-password`, etc.) — except for the invite-only gate at the top of `/signup`.
- The brand identity from Phase 10 (Spectral / Inter / Bagel Fat One / teal palette).
- Anything backend.

---

## 3. Implementation order

### Step 1 — Invite-only env var + `/signup` gate
- Add `ZOLA_INVITE_CODES` to `.env.example` (no default; comma-separated codes).
- New small client component `<InviteGate>` on `/signup`: if `process.env.NEXT_PUBLIC_INVITE_REQUIRED === 'true'`, show a code field first; on submit, check against a small server action that compares against `ZOLA_INVITE_CODES`. If match, set `inviteAccepted = true` in component state and proceed to the existing signup form.
- Set `NEXT_PUBLIC_INVITE_REQUIRED=true` + a sample code in Vercel Production env vars.
- Safety: server action is the only thing that knows the codes; client never sees them.

### Step 2 — `<LandingHero>` + signed-out `/` rewrite
- New file `apps/web/app/landing-hero.tsx` (client component, since CTA may be animated later).
- Replace the signed-out branch in `apps/web/app/page.tsx` with a layout using `<LandingHero>` + `<ProductExplainer>` + `<SourceBand>`.
- Signed-in branch in `page.tsx` is untouched.

### Step 3 — `<ProductExplainer>` + `<SourceBand>`
- `<ProductExplainer>`: three-column grid (stacks on mobile), each cell has a small icon (lucide), heading, 20-word body. Headings: "Discover", "Save", "Share".
- `<SourceBand>`: server-rendered; fetches `is_active=true` sources from FastAPI; renders a CSS-scrolling row of source names in Spectral. Slow horizontal scroll on hover (CSS-only via `animation: scroll 60s linear infinite`).

### Step 4 — `/about` page
- New route `apps/web/app/about/page.tsx` — server component, no data deps.
- Body: a single article with serif body, max-w-prose, ~400 words. Sections (no headings, just paragraphs):
  1. What Zola is (1 paragraph)
  2. What it's not (1 paragraph) — "not an aggregator, not a feed reader, not for skimming"
  3. Content policy (1 paragraph) — link out; respect for source
  4. Who's behind it (1 paragraph) — first-person, you
- Bottom CTA: "Sign up" / "Sign in" depending on auth state.

### Step 5 — `/sources` public page
- New route `apps/web/app/sources/page.tsx` — server component.
- Fetch from `/api/sources` (existing endpoint; already returns `article_count`).
- For each active source: card with name, description, article count, "Browse" link to `/source/[slug]`.
- **NEW field**: each source needs a short public description. Add `sources.public_description text` column via a small migration (`010_phase13_public_descriptions.sql`). Defaults to NULL; we render from `homepage_url`-derived stub or hand-write per source.
- Initial values: I'll hand-write the 27 source descriptions in a SQL seed file, ~50 words each.

### Step 6 — Update nav-bar
- Signed-out users get an "About" link in the nav next to "Browse" — small affordance.
- Signed-in nav unchanged.

### Step 7 — Verify + deploy
- `pnpm typecheck` + `pnpm build` clean.
- Local smoke test in incognito on `localhost:3000`.
- Push to main, `npx vercel --prod --yes`, verify on `zolalongform.com`.
- Update Vercel env vars: `NEXT_PUBLIC_INVITE_REQUIRED=true`, `ZOLA_INVITE_CODES=<comma-list>`.

### Step 8 — Documentation
- Update `PROGRESS.md` Phase 13 entry.
- Update `ROADMAP.md` to mark Phase 13 ✅.

---

## 4. Files I expect to touch

```
apps/web/
├── app/
│   ├── page.tsx                          (UPDATE: signed-out branch only)
│   ├── about/page.tsx                    (NEW)
│   ├── sources/page.tsx                  (NEW)
│   ├── signup/
│   │   ├── page.tsx                      (UPDATE: invite gate)
│   │   └── invite-gate.tsx               (NEW)
│   └── landing-hero.tsx                  (NEW)
├── components/
│   ├── product-explainer.tsx             (NEW)
│   ├── source-band.tsx                   (NEW)
│   ├── sources-grid.tsx                  (NEW)
│   └── nav-bar.tsx                       (UPDATE: add About link for signed-out)
└── lib/
    └── invite.ts                         (NEW; server-side code validation)

services/api/
└── (untouched; sources endpoint already returns article_count)

infra/supabase/migrations/
└── 010_phase13_public_descriptions.sql   (NEW; adds sources.public_description column + seeds)

.env.example                              (UPDATE: add ZOLA_INVITE_CODES + NEXT_PUBLIC_INVITE_REQUIRED)
```

---

## 5. Out of scope (deferred)

- **Custom theme picker** — Phase 14.
- **Marketing analytics** (PostHog / Mixpanel) — Phase 17 territory.
- **Newsletter signup** for non-logged-in visitors — would require a Resend audience setup; skip until you actually have something to say weekly.
- **Per-source detail page for non-logged-in visitors** — `/source/[slug]` already exists but currently requires auth-flavored framing. We'll cross-link to it from `/sources`; if signed-out viewers find friction there, fix separately.
- **OG metadata + Twitter cards for `/`, `/about`, `/sources`** — actually let's include these; they're 30 min and pay off the first time someone shares the link.
- **Open Graph image** (the og:image for `zolalongform.com`) — design effort; defer to Phase 14.

---

## 6. Estimate

- Step 1 (invite gate): ~30 min
- Step 2 (hero): ~1 hour
- Step 3 (explainer + source band): ~2 hours (mostly copy + CSS)
- Step 4 (`/about`): ~1 hour (mostly writing prose)
- Step 5 (`/sources` + migration + seed descriptions): ~2 hours (most of that is writing 27 source descriptions)
- Step 6 (nav): ~10 min
- Step 7 (verify + deploy): ~30 min
- Step 8 (docs): ~30 min

**Total: ~1 full day of focused work.**

---

## 7. Open questions

1. **Should `/sources` link directly to each source's `homepage_url` or to our own `/source/[slug]` page?** Lean: our own — gives us another marketing surface and shows we have depth.
2. **One-or-two-paragraph essay on `/about`, or longer?** Lean: medium-length one-pager. Anything longer is read by zero people.
3. **For the invite codes — random strings, or memorable phrases?** Lean: 3-word phrases (e.g. `thoreau-2026-paper`). Easier to share verbally.

---

*Pending decisions in §1 + open questions in §7. I'll proceed with the defaults unless told otherwise.*
