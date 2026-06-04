-- =============================================================================
-- Article comments (flat, signed-in to write, public to read)
--
-- Apply via:
--   psql "${DATABASE_URL/postgresql+asyncpg:\/\//postgresql://}" \
--     -v ON_ERROR_STOP=1 -f infra/supabase/migrations/019_comments.sql
-- Idempotent.
--
-- Design:
-- - Flat: no parent_id. Reddit-style threading would have ballooned scope.
-- - Soft delete via deleted_at. Owner can delete own; admin can delete any.
--   Deleted rows are filtered out at read time but preserved for audit /
--   undelete.
-- - Body length 1..2000 chars enforced by check constraint.
-- - Cascade: article delete -> comments deleted; profile delete -> same.
--   That matches our 'remove a user, remove their footprint' default.
-- =============================================================================

create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  article_id  uuid not null references public.articles(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz null,

  constraint comments_body_length check (char_length(body) between 1 and 2000)
);

-- Read path: list comments for one article. Most queries filter
-- deleted_at IS NULL, so partial index keeps it lean.
create index if not exists comments_article_alive_idx
  on public.comments (article_id, created_at asc)
  where deleted_at is null;

-- Admin / 'my recent comments': scan by user.
create index if not exists comments_user_idx
  on public.comments (user_id, created_at desc)
  where deleted_at is null;
