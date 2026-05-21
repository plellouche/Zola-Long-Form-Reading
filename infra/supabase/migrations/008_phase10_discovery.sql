-- =============================================================================
-- Phase 10 — Discovery deck, source follows, avatar storage
--
-- Apply via:
--   psql "${DATABASE_URL/postgresql+asyncpg:\/\//postgresql://}" \
--     -v ON_ERROR_STOP=1 -f infra/supabase/migrations/008_phase10_discovery.sql
-- Idempotent.
--
-- Adds:
--   - INTERESTED to user_article_states.status (lightweight positive signal
--     from the swipe deck; does NOT count toward Saves)
--   - New event types for swipe + source-fatigue logging
--   - source_follows table (per-user source subscription)
--   - avatars storage bucket + RLS policies for client-direct upload
-- =============================================================================

-- ---------- user_article_states.status: add INTERESTED ----------
alter table public.user_article_states
  drop constraint if exists user_article_states_status_check;

alter table public.user_article_states
  add constraint user_article_states_status_check
  check (status in ('SAVED', 'READING', 'FINISHED', 'DISMISSED', 'INTERESTED'));

-- recount_article_engagement: INTERESTED is "engagement" for save_count
-- (sorting / popularity) but does not affect finish_count.
create or replace function public.recount_article_engagement(target uuid)
returns void
language sql
as $$
  update public.articles
  set save_count   = coalesce((select count(*) from public.user_article_states
                               where article_id = target
                                 and status in ('SAVED', 'READING', 'FINISHED', 'INTERESTED')), 0),
      finish_count = coalesce((select count(*) from public.user_article_states
                               where article_id = target and status = 'FINISHED'), 0)
  where id = target;
$$;

-- ---------- events.event_type: add swipe + source-fatigue ----------
alter table public.events
  drop constraint if exists events_event_type_check;

alter table public.events
  add constraint events_event_type_check
  check (event_type in (
    'OPEN', 'FINISH', 'SAVE', 'DISMISS', 'LINK_CLICK', 'LIST_ADD',
    'FOLLOW', 'UNFOLLOW',
    'SWIPE_LEFT', 'SWIPE_RIGHT', 'SWIPE_UP', 'SWIPE_DOWN',
    'SOURCE_FATIGUE'
  ));

-- ---------- source_follows ----------
create table if not exists public.source_follows (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  source_id  uuid not null references public.sources(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, source_id)
);

create index if not exists source_follows_user_idx
  on public.source_follows (user_id, created_at desc);
create index if not exists source_follows_source_idx
  on public.source_follows (source_id, created_at desc);

alter table public.source_follows enable row level security;

drop policy if exists source_follows_select_all on public.source_follows;
create policy source_follows_select_all on public.source_follows
  for select using (true);

drop policy if exists source_follows_owner_write on public.source_follows;
create policy source_follows_owner_write on public.source_follows
  for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ---------- avatars storage bucket ----------
-- Public bucket: avatars are visible to anyone visiting a profile page.
-- Writes are gated by RLS so users can only upload into their own folder.
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

-- Public read of objects in the avatars bucket
drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Authed users may insert under their own uid folder
drop policy if exists "avatars owner insert" on storage.objects;
create policy "avatars owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authed users may update / delete their own avatar objects
drop policy if exists "avatars owner update" on storage.objects;
create policy "avatars owner update"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars owner delete" on storage.objects;
create policy "avatars owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
