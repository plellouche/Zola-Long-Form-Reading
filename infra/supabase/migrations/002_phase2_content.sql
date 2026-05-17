-- =============================================================================
-- Phase 2 — sources, articles, article_topics, events
--
-- Apply via:
--   psql "${DATABASE_URL/postgresql+asyncpg:\/\//postgresql://}" \
--     -v ON_ERROR_STOP=1 -f infra/supabase/migrations/002_phase2_content.sql
--
-- Idempotent: safe to re-run. Seed sources at the bottom use ON CONFLICT DO NOTHING.
-- =============================================================================

-- ---------- sources ----------
create table if not exists public.sources (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text unique not null,
  homepage_url      text not null,
  rss_url           text,
  content_policy    text not null default 'REDIRECT_ONLY'
                    check (content_policy in ('REDIRECT_ONLY', 'EMBED_ALLOWED', 'FULLTEXT_ALLOWED')),
  kind              text not null default 'PUBLICATION'
                    check (kind in ('PUBLICATION', 'BLOG', 'DISCOVERY_SURFACE', 'PAYWALLED_FREE_SUBSET')),
  trust_score       real not null default 0.7 check (trust_score >= 0 and trust_score <= 1),
  is_active         boolean not null default true,
  last_ingested_at  timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists sources_slug_idx on public.sources (slug);
create index if not exists sources_active_idx on public.sources (is_active) where is_active = true;

-- ---------- articles ----------
create table if not exists public.articles (
  id                    uuid primary key default gen_random_uuid(),
  source_id             uuid not null references public.sources(id) on delete restrict,
  title                 text not null,
  author                text,
  publication_date      date,
  canonical_url         text unique not null,
  og_image_url          text,
  description           text,
  reading_time_minutes  int check (reading_time_minutes is null or reading_time_minutes >= 0),
  word_count            int check (word_count is null or word_count >= 0),
  content_policy        text not null default 'REDIRECT_ONLY'
                        check (content_policy in ('REDIRECT_ONLY', 'EMBED_ALLOWED', 'FULLTEXT_ALLOWED')),
  full_text             text,
  quality_score         real not null default 0.5 check (quality_score >= 0 and quality_score <= 1),
  save_count            int not null default 0,
  finish_count          int not null default 0,
  submitted_by          uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists articles_source_id_idx on public.articles (source_id);
create index if not exists articles_publication_date_idx on public.articles (publication_date desc nulls last);
create index if not exists articles_created_at_idx on public.articles (created_at desc);

drop trigger if exists articles_set_updated_at on public.articles;
create trigger articles_set_updated_at
  before update on public.articles
  for each row
  execute function public.set_updated_at();

-- Full-text search column (Phase 4 will lean on this).
alter table public.articles drop column if exists search_tsv;
alter table public.articles add column search_tsv tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')),       'A') ||
    setweight(to_tsvector('english', coalesce(author, '')),      'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) stored;
create index if not exists articles_search_tsv_idx on public.articles using gin (search_tsv);

-- ---------- article_topics ----------
create table if not exists public.article_topics (
  article_id  uuid not null references public.articles(id) on delete cascade,
  topic_id    uuid not null references public.topics(id)   on delete cascade,
  weight      real not null default 1.0 check (weight >= 0),
  primary key (article_id, topic_id)
);

create index if not exists article_topics_topic_id_idx on public.article_topics (topic_id);

-- ---------- events ----------
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete set null,
  article_id  uuid references public.articles(id) on delete set null,
  event_type  text not null check (event_type in (
    'OPEN', 'FINISH', 'SAVE', 'DISMISS', 'LINK_CLICK', 'LIST_ADD', 'FOLLOW', 'UNFOLLOW'
  )),
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists events_user_id_idx on public.events (user_id);
create index if not exists events_article_id_idx on public.events (article_id);
create index if not exists events_type_created_at_idx on public.events (event_type, created_at desc);

-- ---------- RLS ----------
alter table public.sources        enable row level security;
alter table public.articles       enable row level security;
alter table public.article_topics enable row level security;
alter table public.events         enable row level security;

-- sources: world-readable; admins write
drop policy if exists sources_select_all on public.sources;
create policy sources_select_all on public.sources
  for select using (true);

drop policy if exists sources_admin_write on public.sources;
create policy sources_admin_write on public.sources
  for all using (public.is_admin()) with check (public.is_admin());

-- articles: world-readable; admins write (Phase 3 will broaden to a user-submission flow)
drop policy if exists articles_select_all on public.articles;
create policy articles_select_all on public.articles
  for select using (true);

drop policy if exists articles_admin_write on public.articles;
create policy articles_admin_write on public.articles
  for all using (public.is_admin()) with check (public.is_admin());

-- article_topics: world-readable; admins write
drop policy if exists article_topics_select_all on public.article_topics;
create policy article_topics_select_all on public.article_topics
  for select using (true);

drop policy if exists article_topics_admin_write on public.article_topics;
create policy article_topics_admin_write on public.article_topics
  for all using (public.is_admin()) with check (public.is_admin());

-- events: owner can read own; admins can read all; anyone can insert their own
drop policy if exists events_select_self on public.events;
create policy events_select_self on public.events
  for select using (user_id = auth.uid() or user_id is null or public.is_admin());

drop policy if exists events_insert_any on public.events;
create policy events_insert_any on public.events
  for insert with check (user_id = auth.uid() or user_id is null);

-- ---------- seed: sources (triaged from scaffolding doc §13) ----------
-- trust_score is a prior for ranking; bump/penalize via admin UI later.
insert into public.sources (name, slug, homepage_url, rss_url, content_policy, kind, trust_score) values
  -- Tier 1: high-trust longform publications with reliable RSS
  ('Aeon',                 'aeon',                 'https://aeon.co',                  'https://aeon.co/feed.rss',                  'REDIRECT_ONLY', 'PUBLICATION', 0.92),
  ('Nautilus',             'nautilus',             'https://nautil.us',                'https://nautil.us/feed',                    'REDIRECT_ONLY', 'PUBLICATION', 0.90),
  ('Longreads',            'longreads',            'https://longreads.com',            'https://longreads.com/feed/',               'REDIRECT_ONLY', 'PUBLICATION', 0.92),
  ('Public Books',         'public-books',         'https://www.publicbooks.org',      'https://www.publicbooks.org/feed/',         'REDIRECT_ONLY', 'PUBLICATION', 0.85),
  ('Orion Magazine',       'orion',                'https://orionmagazine.org',        'https://orionmagazine.org/feed/',           'REDIRECT_ONLY', 'PUBLICATION', 0.88),
  ('Guernica',             'guernica',             'https://www.guernicamag.com',      'https://www.guernicamag.com/feed/',         'REDIRECT_ONLY', 'PUBLICATION', 0.87),
  ('Boston Review',        'boston-review',        'https://www.bostonreview.net',     'https://www.bostonreview.net/feed/',        'REDIRECT_ONLY', 'PUBLICATION', 0.88),
  ('Adventure Journal',    'adventure-journal',    'https://www.adventure-journal.com', 'https://www.adventure-journal.com/feed/',   'REDIRECT_ONLY', 'PUBLICATION', 0.80),
  ('The Paris Review',     'paris-review',         'https://www.theparisreview.org',   'https://www.theparisreview.org/blog/feed/', 'REDIRECT_ONLY', 'PUBLICATION', 0.92),
  ('Literary Hub',         'lithub',               'https://lithub.com',               'https://lithub.com/feed/',                  'REDIRECT_ONLY', 'PUBLICATION', 0.85),
  ('The Conversation',     'the-conversation',     'https://theconversation.com',      'https://theconversation.com/articles.atom', 'REDIRECT_ONLY', 'PUBLICATION', 0.80),
  ('The New Inquiry',      'new-inquiry',          'https://thenewinquiry.com',        'https://thenewinquiry.com/feed/',           'REDIRECT_ONLY', 'PUBLICATION', 0.83),
  ('JSTOR Daily',          'jstor-daily',          'https://daily.jstor.org',          'https://daily.jstor.org/feed/',             'REDIRECT_ONLY', 'PUBLICATION', 0.88),
  ('3 Quarks Daily',       '3quarks',              'https://3quarksdaily.com',         'https://3quarksdaily.com/3quarksdaily/feed','REDIRECT_ONLY', 'PUBLICATION', 0.78),
  ('Latitude Media',       'latitude-media',       'https://www.latitudemedia.com',    NULL,                                        'REDIRECT_ONLY', 'PUBLICATION', 0.80),
  ('Alpinist',             'alpinist',             'http://www.alpinist.com',          NULL,                                        'REDIRECT_ONLY', 'PUBLICATION', 0.85),
  ('Sidetracked',          'sidetracked',          'https://www.sidetrackedmagazine.com', NULL,                                     'REDIRECT_ONLY', 'PUBLICATION', 0.82),
  ('The Rumpus',           'rumpus',               'https://therumpus.net',            'https://therumpus.net/feed/',               'REDIRECT_ONLY', 'PUBLICATION', 0.80),
  ('Grist',                'grist',                'https://grist.org',                'https://grist.org/feed/',                   'REDIRECT_ONLY', 'PUBLICATION', 0.83),
  ('ProPublica',           'propublica',           'https://www.propublica.org',       'https://www.propublica.org/feeds/propublica/main', 'REDIRECT_ONLY', 'PUBLICATION', 0.92),
  -- Tier 2: paywalled with meaningful free subsets
  ('The New Yorker',       'new-yorker',           'https://www.newyorker.com',        NULL, 'REDIRECT_ONLY', 'PAYWALLED_FREE_SUBSET', 0.92),
  ('The Atlantic',         'atlantic',             'https://www.theatlantic.com',      NULL, 'REDIRECT_ONLY', 'PAYWALLED_FREE_SUBSET', 0.88),
  ('Harper''s Magazine',   'harpers',              'https://harpers.org',              NULL, 'REDIRECT_ONLY', 'PAYWALLED_FREE_SUBSET', 0.90),
  ('National Geographic',  'nat-geo',              'https://www.nationalgeographic.com', NULL, 'REDIRECT_ONLY', 'PAYWALLED_FREE_SUBSET', 0.85),
  ('Wired',                'wired',                'https://www.wired.com',            NULL, 'REDIRECT_ONLY', 'PAYWALLED_FREE_SUBSET', 0.82),
  -- Tier 3: individual bloggers
  ('Paul Graham',          'paul-graham',          'https://paulgraham.com',           NULL, 'REDIRECT_ONLY', 'BLOG', 0.88),
  ('Austin Vernon',        'austin-vernon',        'https://austinvernon.site',        NULL, 'REDIRECT_ONLY', 'BLOG', 0.78),
  -- Tier 4: discovery surfaces (not articles themselves; entries here are picks-from)
  ('r/longform',           'reddit-longform',      'https://www.reddit.com/r/longform','https://www.reddit.com/r/longform/.rss',     'REDIRECT_ONLY', 'DISCOVERY_SURFACE', 0.60),
  ('The Sunday Long Read', 'sunday-long-read',     'https://sundaylongread.com',       NULL,                                          'REDIRECT_ONLY', 'DISCOVERY_SURFACE', 0.75)
on conflict (slug) do nothing;
