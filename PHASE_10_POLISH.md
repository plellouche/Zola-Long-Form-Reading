# Phase 10 — Discovery Deck, Polish & Profile Depth

> Companion to `COMMAND_CENTER.md`. Phases 0–8 shipped the web MVP; Phase 9 (mobile) is parked. Phase 10 deepens the web app: a swipe-based discovery surface that trains the recommender, plus a wave of UI polish and richer profile pages.

## Goals

1. **A novel discovery surface** that feels different from Browse/For-You and produces strong, lightweight per-user training signal for the recommender.
2. **Profile depth** — avatar upload, Instagram-style follower/following lists, reading history, richer hierarchy.
3. **Polish backlog** — empty states, bulk ops, source pages, keyboard shortcuts, motion, typography, density.

Done when an invitee can: upload an avatar, swipe through 20 articles in under a minute, see their For-You feed shift toward what they swiped right on, open a follower's profile, click through their followers list, and visit an individual source's page.

---

## 1. Discovery Deck (`/discover`)

The deck is the centerpiece. It surfaces one article at a time with gesture-driven decisions that feed `recs.profile.build_user_topic_profile`.

### Gesture vocabulary

| Gesture | State / event | Topic-profile weight | Notes |
|---|---|---|---|
| Swipe left | `DISMISSED` | `-1.5` (existing) | Pulls profile away from the article's topics. |
| Swipe right | **`INTERESTED`** (new) | `+0.6` | Lightweight positive. Does **not** clutter the Saved tab. |
| Swipe up | `SAVED` | `+1.0` (existing) | Commits to read later — same as the Save button. |
| Tap / click | (no state change) | — | Opens `/article/[id]`. |
| Swipe down | `Event(SOURCE_FATIGUE)` | (none) | Temporarily down-weights this source for 7 days. |

Rationale for adding `INTERESTED` rather than reusing `SAVED`: a deck where every right-swipe adds to Saves would quickly flood `/u/me?tab=saved`. `INTERESTED` is a training signal, not a commitment. The Saved tab stays curated by intent.

### Backend changes

**Migration `008_phase10_discovery.sql`** (idempotent):

- `ALTER TABLE user_article_states` — relax the status check constraint to include `INTERESTED`.
  ```sql
  alter table public.user_article_states
    drop constraint user_article_states_status_check;
  alter table public.user_article_states
    add constraint user_article_states_status_check
    check (status in ('SAVED', 'READING', 'FINISHED', 'DISMISSED', 'INTERESTED'));
  ```
- `recount_article_engagement(target uuid)` — update `save_count` to include `INTERESTED` rows (lightweight engagement is still engagement for sorting).
- New event type allowed: `SWIPE_RIGHT`, `SWIPE_LEFT`, `SWIPE_UP`, `SWIPE_DOWN`. Add to the existing `events.event_type` CHECK if one exists; otherwise the column is freeform and only needs `Event` schema updates.

**`services/api/app/recs/profile.py`**:

```python
STATUS_WEIGHTS = {
    "SAVED":      1.0,
    "READING":    1.5,
    "FINISHED":   2.0,
    "DISMISSED": -1.5,
    "INTERESTED": 0.6,   # new
}
```

Also add a **recency decay** so the deck's signal feels responsive: if `updated_at < 7 days ago`, multiply by `1.5`. This makes the For-You feed shift visibly after a deck session.

**`services/api/app/recs/feed.py`** — add a `for_discover_deck()` entry point:
- Same candidate pool as `for_you_feed` but with `MAX_CANDIDATES_TO_SCORE` lowered and **higher topic-similarity weight** (0.5) so the deck is more decisive about what it shows.
- Diversity loosened: `max_per_source = 4` so a session can include a small streak from a source the user is exploring.
- Returns 25 articles per call (one full deck "round").

**New router `services/api/app/routers/discover.py`**:
- `GET /api/discover/deck?limit=25` → 25 stateful articles
- `POST /api/discover/swipe` body `{ article_id, direction: "left" | "right" | "up" | "down" }`
  - left → upsert `user_article_states` with `DISMISSED` + log `SWIPE_LEFT` event
  - right → upsert with `INTERESTED` + `SWIPE_RIGHT`
  - up → upsert with `SAVED` + `SWIPE_UP`
  - down → no state change; insert `Event(type=SOURCE_FATIGUE, source_id=...)`
- Idempotent: re-swiping the same direction is a no-op; swiping a different direction overwrites status (last-write-wins).

### Frontend

**Route**: `apps/web/app/discover/page.tsx` (server component, prefetches first deck) + `discover-deck.tsx` client component.

**Library**: `framer-motion` (already a transitive dep of shadcn? confirm — otherwise add). Use `motion.div` with `drag="x"`, `dragConstraints`, `onDragEnd` thresholding at ±100px for left/right, ±100px y for up/down. Spring animation on snap-back when below threshold.

**Card stack visual**:
- Top card: full opacity, full size.
- Card+1: scaled 0.95, opacity 0.6, offset down 8px.
- Card+2: scaled 0.9, opacity 0.3, offset down 16px.
- Background: subtle gradient or topic-color tint based on the top card's primary topic.
- Action buttons below the deck mirror gestures (X / heart / bookmark / down-arrow) for mouse + accessibility.

**Card content**: same data as `ArticleCard` but bigger — title, source, byline, ~4-line dek, topic chips, OG image as hero. ~70% viewport height on mobile, 600px max on desktop.

**Empty / end states**:
- Empty deck: "You've seen everything fresh — check back tomorrow. [Browse all]" with a call-to-action linking to `/browse`.
- Mid-session error: keep the user's swiped progress (POSTs are independent), show a toast, allow retry.

**Keyboard shortcuts on `/discover`**: ← → ↑ ↓ map to swipes; `Enter` opens detail. Ties into the broader keyboard-shortcut polish item below.

**Nav**: Add "Discover" to the primary nav alongside Browse. Highlight as `NEW` for first 30 days post-launch.

### Testing checklist
- 25 swipes recorded → `for_you_feed` for the same user returns a measurably different ordering (assert top-5 differs from pre-swipe baseline).
- `DISMISSED` articles stop appearing in the deck.
- `INTERESTED` does not appear in `/u/me?tab=saved` but does appear in a new "Interested" subview (see Profile section).
- Swipe-down logs `SOURCE_FATIGUE`; verify that source's articles down-rank in the next deck for 7 days.

---

## 2. Profile picture + avatar upload

`profiles.avatar_url` already exists. Wire up upload, storage, and display.

### Backend
- **Supabase Storage bucket `avatars`** (public read, authed write). Path scheme: `avatars/{user_id}/{timestamp}.{ext}`.
- **No new API endpoint** — frontend uploads directly to Supabase Storage with the user's JWT (RLS policy enforces `path starts with auth.uid()`), then PATCHes `/api/users/me` with the resulting public URL.
- Storage policy SQL goes in `infra/supabase/migrations/008_phase10_discovery.sql` alongside the deck changes (it's all one phase):
  ```sql
  insert into storage.buckets (id, name, public)
    values ('avatars', 'avatars', true)
    on conflict (id) do nothing;

  create policy "avatars are publicly readable"
    on storage.objects for select
    using (bucket_id = 'avatars');

  create policy "users upload to their own avatar folder"
    on storage.objects for insert
    with check (
      bucket_id = 'avatars'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
  ```

### Frontend
- `/settings` profile section gets an avatar widget: current image (or default initial), "Change photo" button → file picker → client-side resize to 512×512 via `<canvas>` → upload → PATCH profile.
- Constraints: jpg/png/webp only, ≤ 2MB pre-resize, ≤ 200KB post-resize.
- `<Avatar>` component (shadcn) used everywhere a username currently appears: nav bar, profile pages, follow lists, comment-byline-style spots on lists/articles.
- Fallback: colored circle with the user's first initial. Color is hash(`user_id`) → one of 8 tailwind hues — stable per user.

---

## 3. Follower / Following lists (Instagram-style)

Counts are already shown on `/u/[username]`. We need clickable lists.

### Backend
Endpoints exist (`/api/users/{username}/followers`, `/following`) and return `PublicProfile[]`. Add:
- **Pagination**: `?cursor=` + `?limit=` (default 50). Cursor on `created_at desc, follower_id`.
- **`am_following` on each row** so the list can render Follow / Unfollow buttons inline. Already supported in `PublicProfile`; just populate it in the list endpoints.

### Frontend
Two designs, pick one — recommendation is **modal on desktop, full route on mobile** so deep links work.

- **Route**: `/u/[username]/followers` and `/u/[username]/following`. Server components for SEO + shareable URLs.
- **Component**: shared `<FollowList>` — list of rows: `[avatar][display_name][@username][bio truncated][Follow button]`. Tapping a row navigates to that profile.
- **Modal variant on desktop**: clicking the count opens a dialog (shadcn `Dialog`) that lazy-loads the same list. Mobile falls through to the route.
- **Pagination**: infinite scroll with `IntersectionObserver` sentinel at the bottom of the list.

### Profile page (`/u/[username]`) restructure
Currently lists / saved / read tabs. Updated layout:

```
┌─────────────────────────────────────────────────┐
│ [Avatar]  Display Name                          │
│  96px     @username                             │
│           Bio line.                             │
│           [Follow / Edit profile]               │
│                                                 │
│  N lists · M followers · K following            │  ← counts are links
└─────────────────────────────────────────────────┘
[Lists] [Saved] [Read] [Interested]   ← new tab
```

`Interested` tab visible only on `/u/me` (private; it's training data, not a portfolio). Lists `INTERESTED` user_article_states sorted by `updated_at desc`, with a "Move to Saved" / "Dismiss" action on each row.

---

## 4. Polish wins

### 4.1 Empty states
Every list-rendering page gets an empty state with: an illustration or icon, one sentence of context, and a primary CTA.

| Surface | Empty state | CTA |
|---|---|---|
| `/u/me?tab=lists` | "You haven't built any lists yet." | "Create your first list" |
| `/u/me?tab=saved` | "Nothing saved yet." | "Discover articles" → `/discover` |
| `/u/me?tab=read` | "No reading history yet." | "Browse all articles" → `/browse` |
| `/u/me?tab=interested` | "Start swiping to train your feed." | "Open the deck" → `/discover` |
| `/search?q=...` (zero results) | "No matches for \"{q}\"." | "Try a topic" → topic chips |
| `/lists` (no public lists) | "No lists yet." | "Create one" |
| For-You on `/` (no signal yet) | "Tell us what you like." | "Open the deck" + 6 topic chips |
| Followers / Following lists (zero) | "{name} has no followers yet." | (none) |

Create `<EmptyState>` in `components/ui/empty-state.tsx` with props `{ icon, title, body, cta }`.

### 4.2 Reading-history timeline
- New tab `Read` on profile already exists structurally — make it a **grouped-by-day** timeline. Group key = `finished_at::date`. Date headers between groups. Cards in chronological order within a day.
- Add a **count badge per month** at the top: "12 finished in April".
- API: existing `/api/me/articles?status=FINISHED` — add `?order=finished_at_desc` and `?include_counts=true`.

### 4.3 Bulk ops on `/lists`
- Multi-select toggle on the list detail page.
- Once selected: footer bar with "Move to…", "Remove", "Mark finished".
- API endpoints accept arrays — already true for `/api/lists/{id}/items` if we extend `DELETE` to take a body of `{ article_ids: [] }`.

### 4.4 Source detail page (`/source/[slug]`)
- New route. Header: source name, description, trust score badge (admin-only), follow button (we already have follows on users; add a `source_follows` table — or reuse a generic `follows` polymorphic; **recommendation: separate `source_follows` table** to keep the schema clear).
- Recent articles from this source (paginated).
- Cross-link: `/browse` filter chips for source link here; `ArticleCard` source-name becomes a link.
- Reuses recs `source_trust` field.

> **Schema**: `008_phase10_discovery.sql` adds:
> ```sql
> create table if not exists public.source_follows (
>   user_id    uuid not null references public.profiles(id) on delete cascade,
>   source_id  uuid not null references public.sources(id) on delete cascade,
>   created_at timestamptz not null default now(),
>   primary key (user_id, source_id)
> );
> ```

### 4.5 Keyboard shortcuts
- `J` / `K` — next / previous focused card in any feed grid.
- `S` — save focused card.
- `D` — dismiss focused card.
- `G` then `B` / `L` / `D` / `H` — jump to Browse / Lists / Discover / Home.
- `?` — overlay cheat-sheet (shadcn `Dialog`).
- Implementation: `useKeyboardShortcuts(handlers)` hook in `lib/hooks/`. Disabled when focus is inside an `<input>` / `<textarea>` / `[contenteditable]`.

---

## 5. UI polishes

### 5.1 Article-card hierarchy
- Introduce `<FeaturedArticleCard>` variant: full-bleed `og_image`, gradient overlay, title in white over the image, larger type. Used on:
  - `/` For-You: the top-ranked article each session.
  - `/topics/[slug]` and `/source/[slug]`: the first article in the grid.
  - `/discover` empty-state preview.
- Grid layout adapts: featured = 2-column-span, regular = 1-column.

### 5.2 Typography on `/article/[id]`
- Bump title to `text-4xl sm:text-5xl`, tighter leading.
- Byline + source line in small caps tracking-wide.
- Dek/summary in `text-xl text-muted-foreground` with a `max-w-prose` container.
- A prominent outbound CTA — full-width button "Read on {source}" with the source's favicon — placed above the fold.
- "Related articles" section (uses existing `recs.related_articles`) at the bottom — three cards in a row.

### 5.3 Onboarding topic picker
- Replace text checkboxes with topic **tiles**: name + tiny icon (use lucide-react: `Microscope` for Science, `Mountain` for Adventure, etc. — map per topic slug). Selected state = tinted background + checkmark badge.
- 3-column grid on desktop, 2-column on mobile.
- Selection counter at the bottom: "3 of 5+ selected" with a `next` button disabled until 3.

### 5.4 Card density toggle (Settings)
- Three modes: `compact` (tighter padding, smaller image), `comfortable` (current default), `spacious` (more padding, larger image, expanded summary).
- Stored in `profiles.ui_prefs jsonb` (new column) — or `localStorage` only since it's a personal display preference. **Recommendation: localStorage** to avoid a migration; sync to server later if cross-device becomes important.
- `<ArticleCard density="…">` reads from a `DensityContext`.

### 5.5 Motion
- Card hover: `transition-transform hover:-translate-y-0.5 hover:shadow-md`.
- Save / follow buttons: subtle scale on press, color cross-fade on state change.
- Page transitions: nothing global (Next.js handles this); just per-component micro-interactions to avoid feeling SPA-heavy.
- Reduced-motion respect: wrap motion utilities in `motion-safe:`.

### 5.6 Nav bar refinement
- Add `Discover` as a primary link.
- Avatar in the top-right replaces the "@username" text once profile pic is uploaded. Clicking opens a dropdown: Profile · Settings · Sign out · (Admin · if admin).

---

## 6. Implementation plan

Order is roughly bottom-up: schema first, then API, then UI. Each step is independently shippable.

### Step 1 — Schema & storage
1. Write `infra/supabase/migrations/008_phase10_discovery.sql`:
   - Add `INTERESTED` to `user_article_states.status` CHECK.
   - Update `recount_article_engagement` if needed.
   - Create `source_follows` table.
   - Create `avatars` storage bucket + policies.
2. Apply locally via `psql`. Verify with `\d user_article_states` + `select * from storage.buckets`.

### Step 2 — Recs reinforcement
1. Update `STATUS_WEIGHTS` in `services/api/app/recs/profile.py`.
2. Add recency multiplier (`updated_at` < 7d → ×1.5) in `build_user_topic_profile`.
3. Add `for_discover_deck()` in `recs/feed.py` — looser diversity, higher topic-sim weight.
4. Unit tests: synthetic user with 5 swipe-rights on topic A produces a profile dominated by topic A.

### Step 3 — Discover API
1. `routers/discover.py` — `GET /api/discover/deck`, `POST /api/discover/swipe`.
2. Wire into `main.py` router list.
3. Smoke test with `curl`: deck returns 25 articles; swipe POST upserts state.

### Step 4 — Avatar upload (backend)
1. Storage bucket + policies in the same migration.
2. No API changes; PATCH `/api/users/me` already supports `avatar_url`.

### Step 5 — Avatar upload (frontend)
1. `<AvatarUploader>` in `components/avatar-uploader.tsx`: file input → canvas resize → Supabase Storage upload → PATCH profile.
2. `<Avatar>` shadcn component installed and used in nav bar, profile header, follow lists.
3. Settings page adds the uploader.

### Step 6 — Follower / Following lists
1. Backend: paginate `/api/users/{username}/followers` and `/following`; populate `am_following` per row.
2. Frontend: `/u/[username]/followers` + `/following` routes; `<FollowList>` component; modal variant for desktop using `Dialog`.
3. Profile header counts become `<Link>`s.

### Step 7 — Discover deck UI
1. Add `framer-motion` if not already present.
2. `apps/web/app/discover/page.tsx` (server) + `discover-deck.tsx` (client).
3. Card stack with drag, snap thresholds, action buttons, keyboard handlers.
4. Empty-deck + error states.
5. Add `Discover` to nav.

### Step 8 — Profile depth
1. Restructure `/u/[username]` header to include avatar + new counts as links.
2. Add `Interested` tab (visible on `/u/me` only) with move/dismiss actions per row.
3. `Read` tab → grouped-by-day timeline with month-count headers.

### Step 9 — Source detail page
1. `apps/web/app/source/[slug]/page.tsx` — header, follow button, recent articles grid.
2. `<FollowSourceButton>` hitting new `/api/sources/{id}/follow` + `/unfollow` endpoints.
3. Wire `ArticleCard` source-name → `/source/[slug]`.

### Step 10 — Polish wins (parallelizable)
1. `<EmptyState>` component + apply across all surfaces in the table above.
2. Bulk-ops bar on `/list/[id]`.
3. Keyboard shortcuts hook + `?` cheat-sheet overlay.

### Step 11 — UI polishes
1. `<FeaturedArticleCard>` + grid layout adaptation.
2. `/article/[id]` typography pass.
3. Onboarding topic-tile UI with icons.
4. Card density toggle in settings + `DensityContext`.
5. Motion + reduced-motion wrappers across cards and buttons.
6. Nav bar avatar dropdown.

### Step 12 — Documentation
1. Update `COMMAND_CENTER.md`:
   - §10 (recs): note `INTERESTED` status + recency decay.
   - §12: insert Phase 10 between 8 and 9.
   - §15 / §16: move shipped items out of "future improvements".
2. Update `PROGRESS.md` with Phase 10 status block.

---

## 7. Out of scope (deferred again)

- **In-app reader** — still blocked by no `FULLTEXT_ALLOWED` content.
- **Trending feed** — separate weekly-rollup job, not part of this phase.
- **Saved-search alerts** — wait until invitee feedback shows demand.
- **Suggest-an-article moderation queue** — admin-only stays admin-only this phase.
- **Mobile app (Phase 9)** — still parked.

---

## 8. Open questions

1. **Should `INTERESTED` be visible to other users on someone's profile**, or strictly private? Recommendation: **private**, shown only on `/u/me`. Public visibility creates pressure to curate swipes, which destroys their value as training signal.
2. **Should the deck end after 25 cards or be infinite-scroll**? Recommendation: **finite (25), with a "Load more" CTA**. Forces an intentional pause; matches Tinder's pacing.
3. **Source follows — do they affect the For-You feed**? Recommendation: yes, **+0.1 boost** to articles from followed sources, layered into `score_article`. Cheap, expected behavior.
4. **Avatar storage cost** — public bucket is fine for an invite-only cohort. Revisit if abuse becomes a concern.
