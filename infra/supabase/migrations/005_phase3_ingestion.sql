-- =============================================================================
-- Phase 3 — ingestion state, run log, source default topics
--
-- Apply via:
--   psql "${DATABASE_URL/postgresql+asyncpg:\/\//postgresql://}" \
--     -v ON_ERROR_STOP=1 -f infra/supabase/migrations/005_phase3_ingestion.sql
-- Idempotent.
-- =============================================================================

-- ---------- sources: ingestion state columns ----------
alter table public.sources add column if not exists last_ingest_etag         text;
alter table public.sources add column if not exists last_ingest_modified     text;
alter table public.sources add column if not exists last_ingest_status       text
  check (last_ingest_status is null or last_ingest_status in
    ('OK', 'NO_CHANGES', 'NO_RSS', 'BLOCKED', 'ERROR'));
alter table public.sources add column if not exists last_ingest_error        text;
alter table public.sources add column if not exists last_ingest_article_count int not null default 0;
alter table public.sources add column if not exists consecutive_failures      int not null default 0;

-- ---------- ingestion_runs: per-run observability ----------
create table if not exists public.ingestion_runs (
  id                 uuid primary key default gen_random_uuid(),
  source_id          uuid references public.sources(id) on delete set null,
  started_at         timestamptz not null default now(),
  finished_at        timestamptz,
  status             text not null
                     check (status in ('OK', 'NO_CHANGES', 'NO_RSS', 'BLOCKED', 'ERROR')),
  articles_seen      int not null default 0,
  articles_inserted  int not null default 0,
  http_status        int,
  error_message      text,
  triggered_by       text not null default 'cron'  -- 'cron' | 'admin' | 'cli'
);

create index if not exists ingestion_runs_source_id_idx on public.ingestion_runs (source_id, started_at desc);
create index if not exists ingestion_runs_started_at_idx on public.ingestion_runs (started_at desc);

alter table public.ingestion_runs enable row level security;

drop policy if exists ingestion_runs_admin_select on public.ingestion_runs;
create policy ingestion_runs_admin_select on public.ingestion_runs
  for select using (public.is_admin());

-- ---------- source_default_topics: per-source topic priors ----------
-- When a feed item has no other signal, fall back to these for auto-tagging.
-- Combined with keyword-based tagging in packages/ingest/topics.py.
create table if not exists public.source_default_topics (
  source_id  uuid not null references public.sources(id) on delete cascade,
  topic_id   uuid not null references public.topics(id)  on delete cascade,
  weight     real not null default 0.5 check (weight >= 0 and weight <= 1),
  primary key (source_id, topic_id)
);

create index if not exists source_default_topics_source_idx on public.source_default_topics (source_id);

alter table public.source_default_topics enable row level security;

drop policy if exists source_default_topics_select_all on public.source_default_topics;
create policy source_default_topics_select_all on public.source_default_topics
  for select using (true);

drop policy if exists source_default_topics_admin_write on public.source_default_topics;
create policy source_default_topics_admin_write on public.source_default_topics
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- seed: source default topics ----------
-- Strong priors for sources whose subject matter is consistent.
insert into public.source_default_topics (source_id, topic_id, weight)
select s.id, t.id, m.weight
from (values
  ('alpinist',          'mountaineering-climbing', 0.95),
  ('alpinist',          'adventure-exploration',   0.6),
  ('sidetracked',       'adventure-exploration',   0.9),
  ('adventure-journal', 'adventure-exploration',   0.85),
  ('orion',             'nature-environment',      0.9),
  ('grist',             'energy-climate',          0.85),
  ('grist',             'nature-environment',      0.6),
  ('latitude-media',    'energy-climate',          0.9),
  ('jstor-daily',       'history',                 0.6),
  ('public-books',      'literature-essays',       0.6),
  ('paris-review',      'literature-essays',       0.85),
  ('paris-review',      'culture-arts',            0.5),
  ('lithub',            'literature-essays',       0.85),
  ('rumpus',            'literature-essays',       0.7),
  ('boston-review',     'politics-society',        0.6),
  ('boston-review',     'culture-arts',            0.4),
  ('aeon',              'philosophy',              0.5),
  ('aeon',              'science',                 0.5),
  ('nautilus',          'science',                 0.9),
  ('the-conversation',  'science',                 0.5),
  ('the-conversation',  'politics-society',        0.4),
  ('3quarks',           'science',                 0.4),
  ('3quarks',           'philosophy',              0.4),
  ('propublica',        'politics-society',        0.85),
  ('new-inquiry',       'politics-society',        0.6),
  ('new-inquiry',       'culture-arts',            0.5),
  ('paul-graham',       'technology',              0.7),
  ('austin-vernon',     'technology',              0.6),
  ('austin-vernon',     'economics',               0.4)
) as m(source_slug, topic_slug, weight)
join public.sources s on s.slug = m.source_slug
join public.topics t  on t.slug = m.topic_slug
on conflict (source_id, topic_id) do nothing;
