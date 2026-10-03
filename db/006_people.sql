-- 006_people.sql — optimo arc 5a (B2): people in optimo. WRITTEN in arc 5a, NOT applied by Code — Cowork applies it
-- with the Supabase connector (HANDOFF "Mark's manual steps" #1). Idempotent: safe to run twice (proven against a
-- scratch Postgres, docs/evidence/arc5a-slice-5-people-schema.md).
--
-- Additive and backward-compatible with the arc-5a client (which knows nothing about people):
--   • planner_people + a nullable person_id on every per-person planner_* table — no PK is swapped, so today's
--     upserts (on_conflict=id / user_id / series_id,occurrence_date / endpoint) behave exactly as before;
--   • every existing row of Mark's account is backfilled to the "Mark" person WITHOUT firing the merge/log triggers
--     (no version bump, no sync-log flood, nothing re-pulled by clients); another account's rows stay unassigned;
--   • new rows that arrive without person_id (every arc-5a write, every Edge write) get one from a BEFORE INSERT
--     trigger: the first person created by that row's user — Mark's rows → Mark;
--   • family-wide RLS (anyone with press_access_has('optimo.html')) is ADDED alongside the own-row policies, but its
--     effect is held behind `planner_flags.family_access` (default false). Reason: the arc-5a client pulls
--     planner_sync_log and lists calendar accounts without a user filter, and Family Wing grants are opt-out (every
--     active family member is granted by default) — live family policies would pour other people's rows into Mark's
--     device. Arc 5b ships the person-scoped client, then flips the flag (one guarded UPDATE).
--   • planner_settings keeps its user_id PK and planner_ai_profile its unique(user_id); each gains a side-by-side
--     unique(person_id). Arc 5b clients upsert with on_conflict=person_id; the user_id key is retired in a later
--     migration once no client uses it (spec §People).
--
-- Grant name: press keys family apps by page file — optimo's is 'optimo.html' (db/press/optimo_grant.sql).

begin;

-- ---------- people ----------
create table if not exists public.planner_people (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 1 and 60),
  color       text not null default 'family',   -- token key, same palette as categories
  sort_key    double precision not null default 0,
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists planner_people_created_by_idx on public.planner_people (created_by, created_at);

-- Mark: fixed id so every environment (and arc 5b's seed logic) can name him. created_by = Mark's auth user when it
-- exists (the press project); null on a scratch database.
insert into public.planner_people (id, name, color, sort_key, created_by)
values ('5eed0000-0000-4000-8000-00000000a4c0', 'Mark', 'work', 0,
        (select u.id from auth.users u where lower(u.email) = 'markgubb@gmail.com' limit 1))
on conflict (id) do nothing;
update public.planner_people
   set created_by = (select u.id from auth.users u where lower(u.email) = 'markgubb@gmail.com' limit 1)
 where id = '5eed0000-0000-4000-8000-00000000a4c0' and created_by is null;

-- ---------- flags (family-wide access switch; arc 5b flips it) ----------
create table if not exists public.planner_flags (
  key    text primary key,
  value  boolean not null,
  note   text
);
insert into public.planner_flags (key, value, note)
values ('family_access', false, 'arc 5b sets true after the person-scoped client ships (db/006 header)')
on conflict (key) do nothing;

create or replace function public.planner_family_access() returns boolean
  language sql stable security definer set search_path = '' as $$
  select coalesce((select f.value from public.planner_flags f where f.key = 'family_access'), false)
     and public.press_access_has('optimo.html');
$$;

-- ---------- person_id on every per-person table ----------
do $$
declare t text;
begin
  foreach t in array array[
    'planner_tasks','planner_categories','planner_settings','planner_ai_profile','planner_ai_plans',
    'planner_exceptions','planner_calendar_accounts','planner_calendar_links','planner_events',
    'planner_push_subscriptions','planner_reminder_sent','planner_sync_log'] loop
    execute format('alter table public.%I add column if not exists person_id uuid references public.planner_people(id) on delete restrict', t);
    execute format('create index if not exists %I on public.%I (person_id)', t || '_person_idx', t);
  end loop;
end $$;

-- side-by-side keys for the one-row-per-person tables (arc 5b upserts on these)
create unique index if not exists planner_settings_person_key   on public.planner_settings   (person_id);
create unique index if not exists planner_ai_profile_person_key on public.planner_ai_profile (person_id);

-- ---------- backfill: today's data (Mark's account) → Mark, without merge/log side effects ----------
-- Only rows of Mark's auth user are assigned. Another account's rows (none expected today) stay unassigned until that
-- person is picked in arc 5b — assigning them to Mark would collide on the one-row-per-person keys (settings,
-- ai_profile) and would hand their data to the wrong person. Re-running touches nothing new.
do $$
declare t text; trg record;
        mark_uid uuid := (select u.id from auth.users u where lower(u.email) = 'markgubb@gmail.com' limit 1);
begin
  if mark_uid is null then
    raise notice 'db/006: no auth user for markgubb@gmail.com — backfill skipped';
    return;
  end if;
  foreach t in array array[
    'planner_tasks','planner_categories','planner_settings','planner_ai_profile','planner_ai_plans',
    'planner_exceptions','planner_calendar_accounts','planner_calendar_links','planner_events',
    'planner_push_subscriptions','planner_reminder_sent','planner_sync_log'] loop
    for trg in select tgname from pg_trigger where tgrelid = ('public.' || t)::regclass and not tgisinternal loop
      execute format('alter table public.%I disable trigger %I', t, trg.tgname);
    end loop;
    execute format('update public.%I set person_id = %L where person_id is null and user_id = %L',
                   t, '5eed0000-0000-4000-8000-00000000a4c0', mark_uid);
    for trg in select tgname from pg_trigger where tgrelid = ('public.' || t)::regclass and not tgisinternal loop
      execute format('alter table public.%I enable trigger %I', t, trg.tgname);
    end loop;
  end loop;
end $$;

-- ---------- default person for rows written without one (arc-5a client, Edge Functions) ----------
create or replace function public.planner_person_fill() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if new.person_id is null then
    select p.id into new.person_id
      from public.planner_people p
     where p.created_by = new.user_id and p.deleted_at is null
     order by p.created_at, p.id
     limit 1;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'planner_tasks','planner_categories','planner_settings','planner_ai_profile','planner_ai_plans',
    'planner_exceptions','planner_calendar_accounts','planner_calendar_links','planner_events',
    'planner_push_subscriptions','planner_reminder_sent','planner_sync_log'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_person', t);
    -- the only BEFORE INSERT trigger on these tables (merge is BEFORE UPDATE); AFTER triggers (the log) see the filled person
    execute format('create trigger %I before insert on public.%I for each row execute function public.planner_person_fill()', t || '_person', t);
  end loop;
end $$;

-- the sync log carries the row's person (arc 5b pulls by person); same body as 001 plus person_id
create or replace function public.planner_log_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare rid text;
begin
  if tg_table_name = 'planner_exceptions' then
    rid := new.series_id::text || '|' || new.occurrence_date::text;
  elsif tg_table_name = 'planner_settings' then
    rid := new.user_id::text;
  else
    rid := new.id::text;
  end if;
  insert into planner_sync_log (user_id, person_id, table_name, row_id, op)
  values (new.user_id, nullif(to_jsonb(new)->>'person_id', '')::uuid, tg_table_name, rid, lower(tg_op));
  return new;
end $$;

-- ---------- RLS ----------
alter table public.planner_people enable row level security;
alter table public.planner_flags  enable row level security;

-- people: everyone with optimo sees everyone and can add / rename (B2: no extra security); live now — no 5a client reads it
drop policy if exists planner_people_family on public.planner_people;
create policy planner_people_family on public.planner_people for all to authenticated
  using (public.press_access_has('optimo.html')) with check (public.press_access_has('optimo.html'));

-- flags: readable by optimo users, written only by the migration channel
drop policy if exists planner_flags_read on public.planner_flags;
create policy planner_flags_read on public.planner_flags for select to authenticated
  using (public.press_access_has('optimo.html'));

-- family-wide policies ADDED beside the *_own ones (permissive policies OR together); inert until family_access
do $$
declare t text;
begin
  foreach t in array array['planner_tasks','planner_categories','planner_settings','planner_ai_profile','planner_ai_plans',
                           'planner_exceptions','planner_calendar_accounts','planner_push_subscriptions'] loop
    execute format('drop policy if exists %I on public.%I', t || '_family', t);
    execute format('create policy %I on public.%I for all to authenticated using (person_id is not null and public.planner_family_access()) with check (person_id is not null and public.planner_family_access())', t || '_family', t);
  end loop;
  -- server-owned tables stay read-only to clients
  foreach t in array array['planner_calendar_links','planner_events','planner_reminder_sent','planner_sync_log'] loop
    execute format('drop policy if exists %I on public.%I', t || '_family', t);
    execute format('create policy %I on public.%I for select to authenticated using (person_id is not null and public.planner_family_access())', t || '_family', t);
  end loop;
end $$;

-- ---------- Data API grants (new tables + the new column on the column-granted table) ----------
grant select, insert, update, delete on public.planner_people to authenticated, service_role;
revoke all on public.planner_people from anon;
grant select on public.planner_flags to authenticated;
grant select, insert, update, delete on public.planner_flags to service_role;
revoke all on public.planner_flags from anon;
-- planner_calendar_accounts is column-granted (002 hides secret_enc): expose person_id the same way
grant select (person_id) on public.planner_calendar_accounts to authenticated;
grant update (person_id) on public.planner_calendar_accounts to authenticated;

revoke execute on function public.planner_family_access() from public, anon;
grant  execute on function public.planner_family_access() to authenticated, service_role;
revoke execute on function public.planner_person_fill() from public, anon, authenticated;

commit;

-- =============================================================================
-- POST-APPLY VERIFICATION (Cowork, read-only) — expect:
--   select count(*) from planner_people where id = '5eed0000-0000-4000-8000-00000000a4c0' and created_by is not null;  -- 1
--   select t, n from (values
--     ('tasks',(select count(*) from planner_tasks where person_id is null)),
--     ('categories',(select count(*) from planner_categories where person_id is null)),
--     ('settings',(select count(*) from planner_settings where person_id is null)),
--     ('events',(select count(*) from planner_events where person_id is null)),
--     ('sync_log',(select count(*) from planner_sync_log where person_id is null))) v(t,n);         -- all 0
--   select value from planner_flags where key = 'family_access';                                     -- false
--   select max(version) from planner_tasks;  -- unchanged from before the apply (backfill fired no merge trigger)
--   advisors: no new "RLS disabled" / "security definer executable by anon" findings for planner_*
-- =============================================================================
