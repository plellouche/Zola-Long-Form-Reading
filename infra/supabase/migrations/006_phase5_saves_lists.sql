-- =============================================================================
-- Phase 5 — personal organization: per-user article state + reading lists
--
-- Apply via:
--   psql "${DATABASE_URL/postgresql+asyncpg:\/\//postgresql://}" \
--     -v ON_ERROR_STOP=1 -f infra/supabase/migrations/006_phase5_saves_lists.sql
-- Idempotent.
-- =============================================================================

-- ---------- user_article_states ----------
create table if not exists public.user_article_states (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  article_id         uuid not null references public.articles(id)  on delete cascade,
  status             text not null
                     check (status in ('SAVED', 'READING', 'FINISHED', 'DISMISSED')),
  opened_at          timestamptz,
  finished_at        timestamptz,
  time_spent_seconds int  not null default 0,
  updated_at         timestamptz not null default now(),
  unique (user_id, article_id)
);

create index if not exists user_article_states_user_idx       on public.user_article_states (user_id, status, updated_at desc);
create index if not exists user_article_states_article_idx    on public.user_article_states (article_id, status);

drop trigger if exists user_article_states_set_updated_at on public.user_article_states;
create trigger user_article_states_set_updated_at
  before update on public.user_article_states
  for each row
  execute function public.set_updated_at();

-- ---------- save_count / finish_count maintenance trigger ----------
-- Keeps articles.save_count and articles.finish_count denormalized so the
-- recs/sort code doesn't need to JOIN on every read.
--
-- save_count = users with status in (SAVED, READING, FINISHED)
--   (FINISHED is still "engaged", and we don't want save_count to decrement
--    when a user transitions SAVED -> READING -> FINISHED.)
-- finish_count = users with status = FINISHED.
create or replace function public.recount_article_engagement(target uuid)
returns void
language sql
as $$
  update public.articles
  set save_count   = coalesce((select count(*) from public.user_article_states
                               where article_id = target and status in ('SAVED', 'READING', 'FINISHED')), 0),
      finish_count = coalesce((select count(*) from public.user_article_states
                               where article_id = target and status = 'FINISHED'), 0)
  where id = target;
$$;

create or replace function public.user_article_states_after_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recount_article_engagement(old.article_id);
    return old;
  elsif tg_op = 'UPDATE' and old.article_id is distinct from new.article_id then
    perform public.recount_article_engagement(old.article_id);
    perform public.recount_article_engagement(new.article_id);
  else
    perform public.recount_article_engagement(new.article_id);
  end if;
  return new;
end;
$$;

drop trigger if exists user_article_states_after_change on public.user_article_states;
create trigger user_article_states_after_change
  after insert or update or delete on public.user_article_states
  for each row
  execute function public.user_article_states_after_change();

-- ---------- lists ----------
create table if not exists public.lists (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  title           text not null check (length(title) between 1 and 200),
  description     text check (description is null or length(description) <= 2000),
  is_public       boolean not null default true,
  forked_from_id  uuid references public.lists(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists lists_user_idx on public.lists (user_id, updated_at desc);
create index if not exists lists_public_idx on public.lists (is_public, updated_at desc) where is_public = true;

drop trigger if exists lists_set_updated_at on public.lists;
create trigger lists_set_updated_at
  before update on public.lists
  for each row
  execute function public.set_updated_at();

-- ---------- list_items ----------
create table if not exists public.list_items (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references public.lists(id) on delete cascade,
  article_id  uuid not null references public.articles(id) on delete cascade,
  position    int  not null,
  added_at    timestamptz not null default now(),
  unique (list_id, article_id)
);

create index if not exists list_items_list_position_idx on public.list_items (list_id, position);

-- Bump the parent list's updated_at whenever items change, so /lists ordering
-- by updated_at reflects "list activity," not just title edits.
create or replace function public.touch_list_on_items_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    update public.lists set updated_at = now() where id = old.list_id;
    return old;
  else
    update public.lists set updated_at = now() where id = new.list_id;
    return new;
  end if;
end;
$$;

drop trigger if exists list_items_touch_parent on public.list_items;
create trigger list_items_touch_parent
  after insert or update or delete on public.list_items
  for each row
  execute function public.touch_list_on_items_change();

-- ---------- RLS ----------
alter table public.user_article_states enable row level security;
alter table public.lists               enable row level security;
alter table public.list_items          enable row level security;

-- user_article_states: only the owner can see or change theirs; admins see all
drop policy if exists user_article_states_owner_select on public.user_article_states;
create policy user_article_states_owner_select on public.user_article_states
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists user_article_states_owner_write on public.user_article_states;
create policy user_article_states_owner_write on public.user_article_states
  for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- lists: public ones are world-readable, private ones owner-only; owner writes
drop policy if exists lists_select on public.lists;
create policy lists_select on public.lists
  for select using (is_public or user_id = auth.uid() or public.is_admin());

drop policy if exists lists_owner_write on public.lists;
create policy lists_owner_write on public.lists
  for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- list_items: visible when parent list is visible; owner-only writes
drop policy if exists list_items_select on public.list_items;
create policy list_items_select on public.list_items
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.lists l
      where l.id = list_id and (l.is_public or l.user_id = auth.uid())
    )
  );

drop policy if exists list_items_owner_write on public.list_items;
create policy list_items_owner_write on public.list_items
  for all
  using (
    public.is_admin()
    or exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid())
  );
