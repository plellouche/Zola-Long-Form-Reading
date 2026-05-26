-- =============================================================================
-- Per-user Elo ratings for articles (derived from pairwise comparisons)
--
-- Apply via:
--   psql "${DATABASE_URL/postgresql+asyncpg:\/\//postgresql://}" \
--     -v ON_ERROR_STOP=1 -f infra/supabase/migrations/016_article_elo_ratings.sql
-- Idempotent.
--
-- Each row holds one (user, article)'s current Elo score. Updated
-- incrementally inside POST /api/me/articles/{id}/compare — see the
-- update_elo() helper in api/app/elo.py.
--
-- Starting score 1200 (chess convention); K-factor 32 (more aggressive
-- than chess because preference signal is one click and we want
-- convergence inside a couple dozen comparisons).
-- =============================================================================

create table if not exists public.article_elo_ratings (
  user_id           uuid not null references public.profiles(id) on delete cascade,
  article_id        uuid not null references public.articles(id) on delete cascade,
  score             real not null default 1200,
  comparison_count  int  not null default 0,
  updated_at        timestamptz not null default now(),
  primary key (user_id, article_id)
);

create index if not exists article_elo_ratings_user_idx
  on public.article_elo_ratings (user_id, score desc);
