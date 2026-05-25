-- =============================================================================
-- Source expansion — humanities, place, nature, adventure, anthropology
--
-- Apply via:
--   psql "${DATABASE_URL/postgresql+asyncpg:\/\//postgresql://}" \
--     -v ON_ERROR_STOP=1 -f infra/supabase/migrations/010_source_expansion_humanities.sql
-- Idempotent (ON CONFLICT slug DO NOTHING).
--
-- 19 new sources, vetted 2026-05-24:
--   - 17 via RSS (feed parsed, ≥10 recent entries)
--   - 2 via sitemap (no public RSS but clean sitemap with article-URL pattern)
--
-- Editorial direction: down-indexes tech/AI; favors culture, opinion, history,
-- geography, nature, travel, anthropology, adventure. Recorded in memory as
-- feedback-source-curation-direction.
-- =============================================================================

-- -------- Tier 1: nature, history, anthropology, criticism --------

insert into public.sources (slug, name, homepage_url, rss_url, kind, fetch_strategy)
values
  ('hakai',                'Hakai Magazine',         'https://hakaimagazine.com',           'https://hakaimagazine.com/feed/',           'PUBLICATION', 'rss'),
  ('atlas-obscura',        'Atlas Obscura',          'https://www.atlasobscura.com',        'https://www.atlasobscura.com/articles.rss', 'PUBLICATION', 'rss'),
  ('public-domain-review', 'The Public Domain Review','https://publicdomainreview.org',      'https://publicdomainreview.org/rss.xml',    'PUBLICATION', 'rss'),
  ('sapiens',              'Sapiens',                'https://www.sapiens.org',             'https://www.sapiens.org/feed/',             'PUBLICATION', 'rss'),
  ('granta',               'Granta',                 'https://granta.com',                  'https://granta.com/feed/',                  'PUBLICATION', 'rss'),
  ('baffler',              'The Baffler',            'https://thebaffler.com',              'https://thebaffler.com/feed',               'PUBLICATION', 'rss'),
  ('the-point',            'The Point',              'https://thepointmag.com',             'https://thepointmag.com/feed/',             'PUBLICATION', 'rss'),
  ('jstor-daily',          'JSTOR Daily',            'https://daily.jstor.org',             'https://daily.jstor.org/feed/',             'PUBLICATION', 'rss'),
  ('laphams',              'Lapham''s Quarterly',    'https://www.laphamsquarterly.org',    'https://www.laphamsquarterly.org/rss.xml',  'PUBLICATION', 'rss')
on conflict (slug) do nothing;

-- -------- Tier 2: opinion, culture, criticism --------

insert into public.sources (slug, name, homepage_url, rss_url, kind, fetch_strategy)
values
  ('nplusone',           'n+1',                   'https://www.nplusonemag.com',    'https://www.nplusonemag.com/feed/',           'PUBLICATION', 'rss'),
  ('american-scholar',   'The American Scholar',  'https://theamericanscholar.org', 'https://theamericanscholar.org/feed/',        'PUBLICATION', 'rss'),
  ('dissent',            'Dissent Magazine',      'https://www.dissentmagazine.org','https://www.dissentmagazine.org/feed/',       'PUBLICATION', 'rss'),
  ('roads-and-kingdoms', 'Roads & Kingdoms',      'https://roadsandkingdoms.com',   'https://roadsandkingdoms.com/feed/',          'PUBLICATION', 'rss')
on conflict (slug) do nothing;

-- -------- Tier 3: international voices + adventure --------

insert into public.sources (slug, name, homepage_url, rss_url, kind, fetch_strategy)
values
  ('africa-is-a-country', 'Africa Is a Country',  'https://africasacountry.com',      'https://africasacountry.com/feed',         'PUBLICATION', 'rss'),
  ('outside',             'Outside Magazine',     'https://www.outsideonline.com',    'https://www.outsideonline.com/feed/',      'PUBLICATION', 'rss'),
  ('the-drake',           'The Drake',            'https://www.drakemag.com',         'https://www.drakemag.com/feed',            'PUBLICATION', 'rss'),
  ('biographic',          'bioGraphic',           'https://www.biographic.com',       'https://www.biographic.com/feed',          'PUBLICATION', 'rss')
on conflict (slug) do nothing;

-- -------- Sitemap-only sources (no usable RSS) --------

-- Emergence Magazine: WordPress site, RSS returns empty. Sitemap is an index
-- that splits content into essay-sitemap.xml / feature-sitemap.xml / etc.
-- The sitemap strategy recurses into sitemap-indexes already (see
-- strategies/sitemap.py). Pattern restricts to long-form essay + feature URLs.
insert into public.sources (
  slug, name, homepage_url, kind,
  fetch_strategy, sitemap_url, sitemap_url_pattern, min_word_count
)
values (
  'emergence',
  'Emergence Magazine',
  'https://emergencemagazine.org',
  'PUBLICATION',
  'sitemap',
  'https://emergencemagazine.org/sitemap.xml',
  '^https://emergencemagazine\.org/(essay|feature)/[^/]+/?$',
  800
)
on conflict (slug) do nothing;

-- The Dial: international longform, founded 2022. Sitemap lists
-- /articles/{category}/{slug} for every published piece. No RSS endpoint.
-- The negative lookahead excludes /articles/category/* and /articles/tag/*
-- index pages, which would otherwise match the 2-segment-after-/articles/
-- pattern (added 2026-05-25 after 18 false-positive rows landed).
insert into public.sources (
  slug, name, homepage_url, kind,
  fetch_strategy, sitemap_url, sitemap_url_pattern, min_word_count
)
values (
  'the-dial',
  'The Dial',
  'https://www.thedial.world',
  'PUBLICATION',
  'sitemap',
  'https://www.thedial.world/sitemap.xml',
  '^https://www\.thedial\.world/articles/(?!category/|tag/)[^/]+/[^/]+/?$',
  600
)
on conflict (slug) do nothing;

-- =============================================================================
-- Dropped / not added (recorded for future reattempt):
--   - Bookforum            -- RSS returns empty; Squarespace site, sitemap noisy
--   - The Bitter Southerner -- Squarespace, no clean URL pattern
--   - The Drift            -- RSS exists but only carries 2 entries; sitemap
--                              mixes /issue/, /mention/, /article/. Revisit if
--                              they publish more frequently.
--   - Caravan Magazine     -- 404 on every feed + sitemap URL probed
-- =============================================================================
