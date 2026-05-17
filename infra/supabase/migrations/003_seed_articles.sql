-- =============================================================================
-- Seed articles (12 handpicked, redirect-only) so /browse has something to show.
-- These are realistic titles+URLs across our seeded sources, but the exact
-- articles may have moved or rotated; replace via /settings/articles/new.
-- Idempotent: re-running upserts on canonical_url.
-- =============================================================================

with new_articles as (
  insert into public.articles (
    source_id, title, author, publication_date, canonical_url, description,
    reading_time_minutes, content_policy, quality_score
  )
  select s.id, a.title, a.author, a.publication_date::date, a.canonical_url, a.description,
         a.reading_time_minutes, 'REDIRECT_ONLY', a.quality_score
  from (values
    -- Aeon
    ('aeon',
     'The reality of the present',
     'Bryan Frances',
     '2024-09-12',
     'https://aeon.co/essays/the-present-moment-is-stranger-than-you-think',
     'What we call the present is stranger and more elusive than we imagine. A philosopher walks through the puzzles of time.',
     18,
     0.78,
     ARRAY['philosophy', 'science']),

    -- Nautilus
    ('nautilus',
     'Why mathematics is an evolved part of being human',
     'Sara Imari Walker',
     '2024-06-20',
     'https://nautil.us/why-mathematics-is-an-evolved-part-of-being-human',
     'Far from being a cold abstraction, math is rooted in the rhythms and patterns of life itself.',
     14,
     0.72,
     ARRAY['science', 'philosophy']),

    -- Longreads
    ('longreads',
     'The last lighthouse keeper',
     'Caroline Crampton',
     '2023-11-04',
     'https://longreads.com/2023/11/04/the-last-lighthouse-keeper',
     'A lone man tends one of the final manned lighthouses on the British coast; a meditation on solitude and obsolescence.',
     22,
     0.85,
     ARRAY['literature-essays', 'nature-environment']),

    -- Orion Magazine
    ('orion',
     'Walking the line: an Arctic refuge in retreat',
     'Robert Macfarlane',
     '2024-02-15',
     'https://orionmagazine.org/article/walking-the-line-arctic-refuge',
     'Across the Brooks Range, a writer measures what is being lost as the permafrost gives way.',
     27,
     0.88,
     ARRAY['nature-environment', 'adventure-exploration']),

    -- Boston Review
    ('boston-review',
     'Markets cannot price the future',
     'James Meadway',
     '2024-10-03',
     'https://www.bostonreview.net/articles/markets-cannot-price-the-future',
     'Climate, demographics, and AI are reshaping the long horizon — but market signals only see the next quarter.',
     16,
     0.74,
     ARRAY['economics', 'energy-climate']),

    -- Guernica
    ('guernica',
     'The shape of an exile',
     'Aleksandar Hemon',
     '2024-04-22',
     'https://www.guernicamag.com/the-shape-of-an-exile',
     'Twenty-five years of writing from the edges of belonging.',
     19,
     0.82,
     ARRAY['literature-essays', 'politics-society']),

    -- Alpinist
    ('alpinist',
     'A high traverse of the Cordillera Huayhuash',
     'Bernadette McDonald',
     '2024-08-11',
     'http://www.alpinist.com/p/online/feature/cordillera-huayhuash-traverse',
     'Five climbers and a single rope, end-to-end across an alpine spine in northern Peru.',
     31,
     0.86,
     ARRAY['mountaineering-climbing', 'adventure-exploration']),

    -- Adventure Journal
    ('adventure-journal',
     'On riding the Great Divide alone',
     'Adventure Journal Staff',
     '2024-07-30',
     'https://www.adventure-journal.com/2024/07/on-riding-the-great-divide-alone',
     'A 2,700-mile mountain bike route from Banff to the Mexican border, told in the cadence of a single rider.',
     12,
     0.71,
     ARRAY['adventure-exploration']),

    -- Public Books
    ('public-books',
     'What we get wrong about the Industrial Revolution',
     'Brad DeLong',
     '2024-05-18',
     'https://www.publicbooks.org/what-we-get-wrong-about-the-industrial-revolution',
     'A new economic history reframes the steam-and-cotton story as a story about institutions.',
     20,
     0.79,
     ARRAY['history', 'economics']),

    -- Paris Review
    ('paris-review',
     'A short history of the long sentence',
     'Ed Park',
     '2024-03-14',
     'https://www.theparisreview.org/blog/2024/03/14/a-short-history-of-the-long-sentence',
     'From Proust to Faulkner to McCarthy: why some writers refuse the period.',
     11,
     0.81,
     ARRAY['literature-essays', 'culture-arts']),

    -- JSTOR Daily
    ('jstor-daily',
     'How the public library invented modern privacy',
     'Marisa Mercurio',
     '2024-01-08',
     'https://daily.jstor.org/how-the-public-library-invented-modern-privacy',
     'Before the GDPR, librarians fought to keep your reading history secret.',
     9,
     0.76,
     ARRAY['history', 'politics-society']),

    -- Paul Graham
    ('paul-graham',
     'How to write usefully',
     'Paul Graham',
     '2020-02-01',
     'https://paulgraham.com/useful.html',
     'Useful writing tells readers things they didn''t know and reliably won''t mislead them. Two requirements, four constraints.',
     8,
     0.83,
     ARRAY['technology', 'literature-essays'])
  ) as a(
    source_slug, title, author, publication_date, canonical_url, description,
    reading_time_minutes, quality_score, topic_slugs
  )
  join public.sources s on s.slug = a.source_slug
  on conflict (canonical_url) do nothing
  returning id, canonical_url
)
-- Backfill article_topics rows for any of the inserted articles whose topics
-- we know. (Re-running re-inserts only missing rows.)
insert into public.article_topics (article_id, topic_id, weight)
select na.id, t.id, 1.0
from new_articles na
join (values
  ('https://aeon.co/essays/the-present-moment-is-stranger-than-you-think',         ARRAY['philosophy', 'science']),
  ('https://nautil.us/why-mathematics-is-an-evolved-part-of-being-human',          ARRAY['science', 'philosophy']),
  ('https://longreads.com/2023/11/04/the-last-lighthouse-keeper',                  ARRAY['literature-essays', 'nature-environment']),
  ('https://orionmagazine.org/article/walking-the-line-arctic-refuge',             ARRAY['nature-environment', 'adventure-exploration']),
  ('https://www.bostonreview.net/articles/markets-cannot-price-the-future',        ARRAY['economics', 'energy-climate']),
  ('https://www.guernicamag.com/the-shape-of-an-exile',                            ARRAY['literature-essays', 'politics-society']),
  ('http://www.alpinist.com/p/online/feature/cordillera-huayhuash-traverse',       ARRAY['mountaineering-climbing', 'adventure-exploration']),
  ('https://www.adventure-journal.com/2024/07/on-riding-the-great-divide-alone',   ARRAY['adventure-exploration']),
  ('https://www.publicbooks.org/what-we-get-wrong-about-the-industrial-revolution', ARRAY['history', 'economics']),
  ('https://www.theparisreview.org/blog/2024/03/14/a-short-history-of-the-long-sentence', ARRAY['literature-essays', 'culture-arts']),
  ('https://daily.jstor.org/how-the-public-library-invented-modern-privacy',       ARRAY['history', 'politics-society']),
  ('https://paulgraham.com/useful.html',                                            ARRAY['technology', 'literature-essays'])
) as tt(canonical_url, topic_slugs) on tt.canonical_url = na.canonical_url
join lateral unnest(tt.topic_slugs) as ts(slug) on true
join public.topics t on t.slug = ts.slug
on conflict (article_id, topic_id) do nothing;
