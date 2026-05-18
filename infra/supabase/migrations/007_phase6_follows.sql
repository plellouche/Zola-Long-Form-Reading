-- =============================================================================
-- Phase 6 — follows (the social graph)
--
-- Apply via:
--   psql "${DATABASE_URL/postgresql+asyncpg:\/\//postgresql://}" \
--     -v ON_ERROR_STOP=1 -f infra/supabase/migrations/007_phase6_follows.sql
-- Idempotent.
-- =============================================================================

create table if not exists public.follows (
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  followee_id  uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

-- Walking the graph in both directions needs an index on each side.
create index if not exists follows_follower_idx on public.follows (follower_id, created_at desc);
create index if not exists follows_followee_idx on public.follows (followee_id, created_at desc);

-- ---------- RLS ----------
alter table public.follows enable row level security;

-- The graph is public — anyone can see who follows whom (matches profile
-- pages showing follower/following lists). Writes are owner-only.
drop policy if exists follows_select_all on public.follows;
create policy follows_select_all on public.follows
  for select using (true);

drop policy if exists follows_owner_write on public.follows;
create policy follows_owner_write on public.follows
  for all
  using (follower_id = auth.uid() or public.is_admin())
  with check (follower_id = auth.uid() or public.is_admin());
