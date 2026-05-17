-- =============================================================================
-- 004 — Replace the fabricated seed articles (002/003) with 23 URLs verified
-- against each source's own RSS feed on 2026-05-17. Earlier seed URLs were
-- guesses from memory and almost all 404'd.
--
-- Apply via:
--   psql "${DATABASE_URL/postgresql+asyncpg:\/\//postgresql://}" \
--     -v ON_ERROR_STOP=1 -f infra/supabase/migrations/004_reseed_articles_verified.sql
-- Idempotent.
-- =============================================================================

-- ---- delete the old broken seed (cascade clears article_topics) ----
delete from public.articles where canonical_url in (
  'https://aeon.co/essays/the-present-moment-is-stranger-than-you-think',
  'https://nautil.us/why-mathematics-is-an-evolved-part-of-being-human',
  'https://longreads.com/2023/11/04/the-last-lighthouse-keeper',
  'https://orionmagazine.org/article/walking-the-line-arctic-refuge',
  'https://www.bostonreview.net/articles/markets-cannot-price-the-future',
  'https://www.guernicamag.com/the-shape-of-an-exile',
  'http://www.alpinist.com/p/online/feature/cordillera-huayhuash-traverse',
  'https://www.adventure-journal.com/2024/07/on-riding-the-great-divide-alone',
  'https://www.publicbooks.org/what-we-get-wrong-about-the-industrial-revolution',
  'https://www.theparisreview.org/blog/2024/03/14/a-short-history-of-the-long-sentence',
  'https://daily.jstor.org/how-the-public-library-invented-modern-privacy'
  -- paulgraham.com/useful.html is real; keep that one
);

-- ---- insert verified articles + topic links ----
with new_articles as (
  insert into public.articles (
    source_id, title, author, publication_date, canonical_url, description,
    reading_time_minutes, content_policy, quality_score
  )
  select s.id, a.title, a.author, a.publication_date::date, a.canonical_url, a.description,
         a.reading_time_minutes, 'REDIRECT_ONLY', a.quality_score
  from (values
    -- Aeon
    ('aeon',  'Gen Z but two centuries ago',  'Aeon Essays',  '2026-05-15',
     'https://aeon.co/essays/young-people-now-and-the-mal-du-siecle-of-19th-century-france',
     'A generation of young people with "full hearts in an empty world" sought hope amid widespread malaise — the parallels between 19th-century mal du siècle and Gen Z.',
     18, 0.82),
    ('aeon',  'Rights require money',  'Aeon Essays',  '2026-05-14',
     'https://aeon.co/essays/to-fund-human-rights-we-need-a-global-fair-tax-convention',
     'Meaningful progress on human rights demands a fundamental restructuring of global financial systems.',
     16, 0.78),

    -- Longreads
    ('longreads', 'Wish You Were Her',  'Peter Rubin',  '2026-05-12',
     'https://longreads.com/2026/05/12/wish-you-were-her/',
     'A profile and meditation on parasocial intimacy in the age of livestreamers.',
     22, 0.84),
    ('longreads', 'ChatGPT Gave Me Chilling Advice—as I Simulated Planning a Mass Shooting',  'Brendan Fitzgerald',  '2026-05-12',
     'https://longreads.com/2026/05/12/ai-chatbot-violence-guardrails-investigation/',
     'An investigation into how easily AI chatbots can be coaxed past their guardrails.',
     25, 0.80),
    ('longreads', 'The Banal Horror of Jimmy Fallon',  'Seyward Darby',  '2026-05-12',
     'https://longreads.com/2026/05/12/the-banal-horror-of-jimmy-fallon/',
     'On celebrity, niceness, and the limits of late-night television.',
     14, 0.76),

    -- Paris Review
    ('paris-review', 'In "Mutual Analysis" with Wallace Shawn''s Moth Days',  'George Prochnik',  '2026-05-15',
     'https://www.theparisreview.org/blog/2026/05/15/in-mutual-analysis-with-wallace-shawns-moth-days/',
     'On Wallace Shawn''s newest book and the strange shape of his attention.',
     11, 0.85),
    ('paris-review', 'The Literary Agent''s Invisible Hand: Laura B. McGrath on Middlemen',  'Rosa Lyster',  '2026-05-14',
     'https://www.theparisreview.org/blog/2026/05/14/the-literary-agents-invisible-hand-laura-b-mcgrath-on-middlemen/',
     'A conversation about what literary agents actually do and why their work is largely invisible.',
     10, 0.79),

    -- Public Books
    ('public-books', 'Fascism''s Building Blocks: 30 Years of Breaking Welfare',  'Imani Radney',  '2026-05-15',
     'https://www.publicbooks.org/fascisms-building-blocks-30-years-of-breaking-welfare/',
     'How three decades of welfare retrenchment built the political ground for modern authoritarianism.',
     19, 0.81),
    ('public-books', 'Xochitl Gonzalez on "Last Night in Brooklyn"',  'Megan Cummins',  '2026-05-13',
     'https://www.publicbooks.org/xochitl-gonzalez-on-last-night-in-brooklyn/',
     'An interview about the new novel, gentrification, and writing the borough you grew up in.',
     12, 0.77),

    -- JSTOR Daily
    ('jstor-daily', 'The Violent History Behind Nutmeg',  'H.M.A. Leow',  '2026-05-14',
     'https://daily.jstor.org/the-violent-history-behind-nutmeg/',
     'How a single spice became the pretext for genocide in the Banda Islands.',
     8, 0.79),
    ('jstor-daily', 'The Forgotten Untouchables of France',  'Ed Simon',  '2026-05-13',
     'https://daily.jstor.org/the-forgotten-untouchables-of-france/',
     'The Cagots: a French caste whose origins remain disputed and whose treatment was systematically cruel.',
     9, 0.78),

    -- Adventure Journal
    ('adventure-journal', 'Sleeping Soft While Sleeping Rough',  'Stephen Casimiro',  '2026-02-18',
     'https://www.adventure-journal.com/2026/02/sleeping-soft-while-sleeping-rough/',
     'On the small comforts that make a bivy night something other than punishment.',
     6, 0.70),
    ('adventure-journal', 'How to Have the Perfect Week',  'Stephen Casimiro',  '2025-12-17',
     'https://www.adventure-journal.com/2025/12/how-to-have-the-perfect-week/',
     'A loose template for the kind of week you want to remember.',
     5, 0.68),

    -- Paul Graham
    ('paul-graham', 'The Brand Age',  'Paul Graham',  '2025-12-01',
     'https://paulgraham.com/brandage.html',
     'How the economy reorganized around brand instead of product, and where that leaves the people doing the work.',
     11, 0.83),
    ('paul-graham', 'Good Writing',  'Paul Graham',  '2025-10-01',
     'https://paulgraham.com/goodwriting.html',
     'What makes writing good is, more than anything, that it''s right.',
     7, 0.85),
    ('paul-graham', 'What to Do',  'Paul Graham',  '2025-08-01',
     'https://paulgraham.com/do.html',
     'Help people, take care of the world, and make good new things — in roughly that priority.',
     9, 0.84),
    ('paul-graham', 'How to Write Usefully',  'Paul Graham',  '2020-02-01',
     'https://paulgraham.com/useful.html',
     'Useful writing tells readers things they didn''t know and reliably won''t mislead them. Two requirements, four constraints.',
     8, 0.86),

    -- Grist
    ('grist', 'Chevron wants a school district tax break for a data center power plant',  'Molly Taft',  '2026-05-17',
     'https://grist.org/energy/chevron-wants-a-school-district-tax-break-for-a-data-center-power-plant/',
     'Texas''s data center build-out is reshaping local tax bases and grid economics.',
     10, 0.78),
    ('grist', 'Wild blueberry farms across Maine suffer as climate change upends growing seasons',  'Sydney Cromwell',  '2026-05-16',
     'https://grist.org/food-and-agriculture/wild-blueberry-farms-across-maine-suffer-as-climate-change-upends-growing-seasons/',
     'A heritage crop, a shifting harvest window, and what that means for downeast Maine.',
     11, 0.75),

    -- Nautilus
    ('nautilus', 'What''s Black and White and Reveals Historic Porpoise Distributions?',  'Devin Reese',  '2026-05-15',
     'https://nautil.us/whats-black-and-white-and-reveals-historic-porpoise-distributions-1280867/',
     'Naturalist sketches and 19th-century whaling logs are rewriting the map of where porpoises used to live.',
     7, 0.74),
    ('nautilus', 'Ancient Teeth Hint at Homo Erectus-Denisovan Interbreeding',  'Jake Currie',  '2026-05-15',
     'https://nautil.us/ancient-teeth-hint-at-homo-erectus-denisovan-interbreeding-1280849/',
     'Fossil dental morphology suggests a longer overlap between Homo erectus and our Denisovan ancestors than previously believed.',
     6, 0.76),

    -- Guernica
    ('guernica', 'Notes on Going Viral',  'Isaac James Richards',  '2026-05-15',
     'https://www.guernicamag.com/notes-on-going-viral/',
     'On attention, exhaustion, and trying to stay yourself while the algorithm eats.',
     13, 0.80),
    ('guernica', 'Snow',  'Sohrab Hura',  '2026-05-15',
     'https://www.guernicamag.com/snow-2/',
     'A short essay on quiet, weather, and what slowness asks of us.',
     8, 0.78)
  ) as a(source_slug, title, author, publication_date, canonical_url, description,
         reading_time_minutes, quality_score)
  join public.sources s on s.slug = a.source_slug
  on conflict (canonical_url) do nothing
  returning id, canonical_url
)
insert into public.article_topics (article_id, topic_id, weight)
select na.id, t.id, 1.0
from new_articles na
join (values
  ('https://aeon.co/essays/young-people-now-and-the-mal-du-siecle-of-19th-century-france',                            ARRAY['history', 'culture-arts']),
  ('https://aeon.co/essays/to-fund-human-rights-we-need-a-global-fair-tax-convention',                                ARRAY['politics-society', 'economics']),
  ('https://longreads.com/2026/05/12/wish-you-were-her/',                                                              ARRAY['literature-essays', 'culture-arts']),
  ('https://longreads.com/2026/05/12/ai-chatbot-violence-guardrails-investigation/',                                   ARRAY['technology', 'politics-society']),
  ('https://longreads.com/2026/05/12/the-banal-horror-of-jimmy-fallon/',                                               ARRAY['culture-arts', 'literature-essays']),
  ('https://www.theparisreview.org/blog/2026/05/15/in-mutual-analysis-with-wallace-shawns-moth-days/',                 ARRAY['literature-essays', 'culture-arts']),
  ('https://www.theparisreview.org/blog/2026/05/14/the-literary-agents-invisible-hand-laura-b-mcgrath-on-middlemen/',  ARRAY['literature-essays']),
  ('https://www.publicbooks.org/fascisms-building-blocks-30-years-of-breaking-welfare/',                               ARRAY['politics-society', 'history']),
  ('https://www.publicbooks.org/xochitl-gonzalez-on-last-night-in-brooklyn/',                                          ARRAY['literature-essays', 'culture-arts']),
  ('https://daily.jstor.org/the-violent-history-behind-nutmeg/',                                                       ARRAY['history']),
  ('https://daily.jstor.org/the-forgotten-untouchables-of-france/',                                                    ARRAY['history', 'politics-society']),
  ('https://www.adventure-journal.com/2026/02/sleeping-soft-while-sleeping-rough/',                                    ARRAY['adventure-exploration']),
  ('https://www.adventure-journal.com/2025/12/how-to-have-the-perfect-week/',                                          ARRAY['adventure-exploration']),
  ('https://paulgraham.com/brandage.html',                                                                              ARRAY['economics', 'culture-arts']),
  ('https://paulgraham.com/goodwriting.html',                                                                           ARRAY['literature-essays', 'technology']),
  ('https://paulgraham.com/do.html',                                                                                    ARRAY['philosophy', 'technology']),
  ('https://paulgraham.com/useful.html',                                                                                ARRAY['literature-essays', 'technology']),
  ('https://grist.org/energy/chevron-wants-a-school-district-tax-break-for-a-data-center-power-plant/',                ARRAY['energy-climate', 'politics-society']),
  ('https://grist.org/food-and-agriculture/wild-blueberry-farms-across-maine-suffer-as-climate-change-upends-growing-seasons/', ARRAY['energy-climate', 'nature-environment']),
  ('https://nautil.us/whats-black-and-white-and-reveals-historic-porpoise-distributions-1280867/',                     ARRAY['science', 'nature-environment']),
  ('https://nautil.us/ancient-teeth-hint-at-homo-erectus-denisovan-interbreeding-1280849/',                            ARRAY['science', 'history']),
  ('https://www.guernicamag.com/notes-on-going-viral/',                                                                ARRAY['culture-arts', 'technology']),
  ('https://www.guernicamag.com/snow-2/',                                                                              ARRAY['literature-essays'])
) as tt(canonical_url, topic_slugs) on tt.canonical_url = na.canonical_url
join lateral unnest(tt.topic_slugs) as ts(slug) on true
join public.topics t on t.slug = ts.slug
on conflict (article_id, topic_id) do nothing;
