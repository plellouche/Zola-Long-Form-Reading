-- =============================================================================
-- Pairwise comparisons between articles (Beli-core)
--
-- Apply via:
--   psql "${DATABASE_URL/postgresql+asyncpg:\/\//postgresql://}" \
--     -v ON_ERROR_STOP=1 -f infra/supabase/migrations/015_article_comparisons.sql
-- Idempotent.
--
-- After a user rates an article, the UI prompts: "Which did you prefer,
-- this or <previously rated piece>?" Each click stores one row here.
-- The data backs a personal canonical ranking (Elo or Bradley-Terry; not
-- yet computed — that's the next iteration). For now we just collect the
-- signal cleanly so the feature is usable end-to-end.
--
-- Conventions:
-- - article_a, article_b are unordered: we normalize so article_a.id < article_b.id
--   before insert. This lets the unique constraint dedupe both orders.
-- - winner_id is one of {article_a, article_b}.
-- - A user can re-compare the same pair (their taste evolves); ON CONFLICT
--   updates the winner + updated_at.
-- =============================================================================

create table if not exists public.article_comparisons (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  article_a   uuid not null references public.articles(id) on delete cascade,
  article_b   uuid not null references public.articles(id) on delete cascade,
  winner_id   uuid not null references public.articles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint article_comparisons_distinct check (article_a <> article_b),
  constraint article_comparisons_ordered  check (article_a < article_b),
  constraint article_comparisons_winner   check (winner_id in (article_a, article_b)),
  constraint article_comparisons_uniq     unique (user_id, article_a, article_b)
);

create index if not exists article_comparisons_user_idx
  on public.article_comparisons (user_id);
