-- =============================================================================
-- Phase 1 — auth profiles, topics, user_topics
--
-- Apply via: psql "$DATABASE_URL" -f infra/supabase/migrations/001_phase1_auth_profiles.sql
-- (or paste into Supabase SQL Editor and run as one statement)
--
-- Idempotent: safe to re-run.
-- =============================================================================

-- ---------- profiles (extends auth.users) ----------
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        text unique,                              -- nullable until onboarding completes
  display_name    text,
  avatar_url      text,
  bio             text,
  role            text not null default 'user' check (role in ('user', 'admin')),
  onboarded_at    timestamptz,                              -- null = onboarding incomplete
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists profiles_username_idx on public.profiles (username);

-- ---------- topics ----------
create table if not exists public.topics (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text unique not null,
  description     text,
  parent_id       uuid references public.topics(id) on delete set null
);

-- ---------- user_topics (onboarding interests) ----------
create table if not exists public.user_topics (
  user_id         uuid not null references public.profiles(id) on delete cascade,
  topic_id        uuid not null references public.topics(id)   on delete cascade,
  weight          real not null default 1.0,
  created_at      timestamptz not null default now(),
  primary key (user_id, topic_id)
);

-- ---------- updated_at trigger (reusable) ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- ---------- auth.users → public.profiles on signup ----------
-- Creates an empty profile row when a user signs up. Username and onboarded_at
-- stay null; the onboarding UI fills them in before the user can use the app.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();

-- ---------- helper: is_admin() ----------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ---------- RLS ----------
alter table public.profiles    enable row level security;
alter table public.topics      enable row level security;
alter table public.user_topics enable row level security;

-- profiles: public read of completed profiles; owner can read/write self; admins can read/write all
drop policy if exists profiles_select_public on public.profiles;
create policy profiles_select_public on public.profiles
  for select
  using (onboarded_at is not null or id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- No INSERT policy — only the signup trigger writes here (SECURITY DEFINER bypasses RLS).
-- No DELETE policy — handled by auth.users cascade.

-- topics: world-readable; only admins write
drop policy if exists topics_select_all on public.topics;
create policy topics_select_all on public.topics
  for select
  using (true);

drop policy if exists topics_admin_write on public.topics;
create policy topics_admin_write on public.topics
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- user_topics: owner read/write self; public can read others' (for recommendations later)
drop policy if exists user_topics_select_all on public.user_topics;
create policy user_topics_select_all on public.user_topics
  for select
  using (true);

drop policy if exists user_topics_owner_write on public.user_topics;
create policy user_topics_owner_write on public.user_topics
  for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ---------- seed topics ----------
insert into public.topics (name, slug, description) values
  ('Philosophy',                 'philosophy',                 'Ideas, ethics, metaphysics, mind'),
  ('Science',                    'science',                    'Research and ideas across the sciences'),
  ('Nature & Environment',       'nature-environment',         'Ecology, wilderness, conservation'),
  ('Mountaineering & Climbing',  'mountaineering-climbing',    'Alpinism, rock, expeditions'),
  ('Adventure & Exploration',    'adventure-exploration',      'Expeditions, travel, the outdoors'),
  ('Politics & Society',         'politics-society',           'Politics, sociology, current affairs'),
  ('Culture & Arts',             'culture-arts',               'Film, music, visual art, design'),
  ('Literature & Essays',        'literature-essays',          'Fiction, criticism, literary journalism'),
  ('Energy & Climate',           'energy-climate',             'Climate, energy systems, transition'),
  ('History',                    'history',                    'Historical writing across eras'),
  ('Technology',                 'technology',                 'Computing, software, the internet'),
  ('Economics',                  'economics',                  'Markets, finance, political economy')
on conflict (slug) do nothing;
