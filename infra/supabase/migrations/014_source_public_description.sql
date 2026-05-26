-- =============================================================================
-- Per-source public-facing description
--
-- Apply via:
--   psql "${DATABASE_URL/postgresql+asyncpg:\/\//postgresql://}" \
--     -v ON_ERROR_STOP=1 -f infra/supabase/migrations/014_source_public_description.sql
-- Idempotent.
--
-- Hand-written ~40-50 word blurb that explains what a publication does, in
-- the curator's voice. Surfaces on /sources cards and /source/[slug] pages,
-- gives readers a reason to click in. NULL means "no description yet" — the
-- UI falls back to just the source name + homepage host.
-- =============================================================================

alter table public.sources
  add column if not exists public_description text null;
