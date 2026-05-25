-- =============================================================================
-- Per-finish rating (Beli-style)
--
-- Apply via:
--   psql "${DATABASE_URL/postgresql+asyncpg:\/\//postgresql://}" \
--     -v ON_ERROR_STOP=1 -f infra/supabase/migrations/013_user_article_rating.sql
-- Idempotent.
--
-- After a reader marks an article FINISHED, they can rate it
-- LOVED | LIKED | OK. Stored on the same row that already tracks status.
-- Nullable: a finish without a rating is fine; the UI nags but doesn't
-- block. Backbone for personal top-10s and ranking-weighted leaderboards.
-- =============================================================================

alter table public.user_article_states
  add column if not exists rating text null
    check (rating is null or rating in ('LOVED', 'LIKED', 'OK'));

-- Partial index speeds up "all of user X's ratings" queries for top-10 pages.
create index if not exists user_article_states_ratings_idx
  on public.user_article_states (user_id, rating)
  where rating is not null;
