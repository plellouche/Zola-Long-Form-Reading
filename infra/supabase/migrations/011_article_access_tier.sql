-- =============================================================================
-- Per-article paywall state (Phase 13-followup)
--
-- Apply via:
--   psql "${DATABASE_URL/postgresql+asyncpg:\/\//postgresql://}" \
--     -v ON_ERROR_STOP=1 -f infra/supabase/migrations/011_article_access_tier.sql
-- Idempotent.
--
-- Adds:
--   - articles.access_tier enum: free | metered | locked | unknown
--     Source of truth is the publisher's emitted metadata:
--       <meta property="article:content_tier" content="free|metered|locked">
--     With a schema.org isAccessibleForFree fallback. See packages/ingest/og.py.
--
--   The 'unknown' default means we didn't detect a signal — most independent
--   publishers don't tag content_tier and we treat their work as free by
--   convention (Paul Graham, Aeon, Hakai, etc.). The UI suppresses the chip
--   for both 'free' and 'unknown'; chips render only for 'metered' / 'locked'.
-- =============================================================================

alter table public.articles
  add column if not exists access_tier text not null default 'unknown'
    check (access_tier in ('free', 'metered', 'locked', 'unknown'));

-- Partial index: most queries that care about access_tier want to find the
-- paywalled subset (or to exclude it). Full index would be wasteful since
-- 'unknown' dominates.
create index if not exists articles_paywalled_idx
  on public.articles (access_tier)
  where access_tier in ('metered', 'locked');
