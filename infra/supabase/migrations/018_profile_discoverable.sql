-- =============================================================================
-- Per-user opt-in to the public /users directory
--
-- Apply via:
--   psql "${DATABASE_URL/postgresql+asyncpg:\/\//postgresql://}" \
--     -v ON_ERROR_STOP=1 -f infra/supabase/migrations/018_profile_discoverable.sql
-- Idempotent.
--
-- Default false: users are hidden from /users until they flip the toggle
-- in /settings. Profiles remain visible at /u/{username} regardless of
-- this flag — discoverable just controls listing on the browse surface.
-- =============================================================================

alter table public.profiles
  add column if not exists discoverable boolean not null default false;

create index if not exists profiles_discoverable_idx
  on public.profiles (discoverable, created_at desc)
  where discoverable = true and onboarded_at is not null;
