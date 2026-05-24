-- =============================================================================
-- Fetch strategies — multiple ways to discover articles for a source
--
-- Apply via:
--   psql "${DATABASE_URL/postgresql+asyncpg:\/\//postgresql://}" \
--     -v ON_ERROR_STOP=1 -f infra/supabase/migrations/009_phase13_fetch_strategies.sql
-- Idempotent.
--
-- Adds:
--   - sources.fetch_strategy enum (rss / archive / sitemap / manual)
--   - sources.archive_url + archive_link_selector for archive-walker sources
--     (e.g. paulgraham.com/articles.html, lapham's quarterly issue index)
--   - sources.sitemap_url + sitemap_url_pattern for sources whose long-form
--     content is mixed into a larger sitemap (e.g. The New Yorker's /magazine
--     URL prefix versus their news desk)
--   - sources.min_word_count: per-source minimum word count to filter out
--     short news items when walking large sitemaps. Default 0 keeps existing
--     behavior; sources that publish daily news + occasional long-form should
--     set this to ~1000–1500.
-- =============================================================================

alter table public.sources
  add column if not exists fetch_strategy text not null default 'rss'
    check (fetch_strategy in ('rss', 'archive', 'sitemap', 'manual'));

alter table public.sources
  add column if not exists archive_url text;
alter table public.sources
  add column if not exists archive_link_selector text;

alter table public.sources
  add column if not exists sitemap_url text;
alter table public.sources
  add column if not exists sitemap_url_pattern text;   -- regex applied to URLs

alter table public.sources
  add column if not exists min_word_count int not null default 0;
