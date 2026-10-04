-- 001_planner.sql — optimo v0.1 schema. Supabase project: press (eepjhpyziczrxvirczio).
-- Cowork applied it via its Supabase connector on 2026-09-26 (kickoff).
-- Contract: docs/spec.md §5. Every table carries the sync columns; merge is field-level LWW.

create extension if not exists pgcrypto;

-- ---------- tables ----------
create table if not exists planner_categories (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  color       text not null default 'work',   -- token key, e.g. work|meet|health|personal|family|errand|learn|home
  icon        text not null default 'dot',    -- icon key from src/icons
  sort_key    double precision not null default 0,
  version     bigint not null default 1,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  field_ts    jsonb not null default '{}'::jsonb,
  device_id   text
);

create table if not exists planner_tasks (
  id            uuid primary key,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title         text not null default '',
  notes         text not null default '',
  category_id   uuid references planner_categories(id) on delete set null,
  priority      smallint not null default 0 check (priority between 0 and 3),
  start_at      timestamptz,                  -- null => inbox
  duration_min  integer not null default 30 check (duration_min >= 0),
  all_day       boolean not null default false,
  completed_at  timestamptz,
  subtasks      jsonb not null default '[]'::jsonb,   -- [{id,title,done}]
  reminders     jsonb not null default '[]'::jsonb,   -- [minutes_before]
  sort_key      double precision not null default 0,
  rrule         text,                          -- RFC 5545 RRULE, series rows only
  dtstart       timestamptz,                  -- series anchor
  series_id     uuid,                          -- set on exception-override rows; null on plain tasks
  version       bigint not null default 1,
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  field_ts      jsonb not null default '{}'::jsonb,
  device_id     text
);
create index if not exists planner_tasks_user_start_idx on planner_tasks (user_id, start_at) where deleted_at is null;
create index if not exists planner_tasks_user_inbox_idx on planner_tasks (user_id, sort_key) where start_at is null and deleted_at is null;
create index if not exists planner_tasks_series_idx on planner_tasks (series_id) where series_id is not null;

create table if not exists planner_exceptions (
  series_id        uuid not null references planner_tasks(id) on delete cascade,
  occurrence_date  date not null,
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_id          uuid references planner_tasks(id) on delete cascade,  -- override row, null if skipped only
  skipped          boolean not null default false,
  version          bigint not null default 1,
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  field_ts         jsonb not null default '{}'::jsonb,
  device_id        text,
  primary key (series_id, occurrence_date)
);

create table if not exists planner_settings (
  user_id     uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  version     bigint not null default 1,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  field_ts    jsonb not null default '{}'::jsonb,
  device_id   text
);

create table if not exists planner_sync_log (
  seq         bigserial primary key,
  user_id     uuid not null,
  table_name  text not null,
  row_id      text not null,      -- uuid text, or 'series_id|occurrence_date' for exceptions
  op          text not null check (op in ('insert','update')),
  at          timestamptz not null default now()
);
create index if not exists planner_sync_log_user_seq_idx on planner_sync_log (user_id, seq);

-- ---------- field-level last-writer-wins merge (BEFORE UPDATE) ----------
create or replace function planner_merge() returns trigger
language plpgsql as $$
declare
  oldj jsonb := to_jsonb(old);
  newj jsonb := to_jsonb(new);
  merged jsonb := newj;
  ts jsonb := coalesce(old.field_ts, '{}'::jsonb);
  k text;
  ts_in numeric; ts_old numeric;
begin
  for k in select jsonb_object_keys(oldj) loop
    if k in ('id','user_id','version','updated_at','field_ts','series_id','occurrence_date') then continue; end if;
    ts_in  := coalesce((new.field_ts->>k)::numeric, 0);
    ts_old := coalesce((old.field_ts->>k)::numeric, 0);
    if ts_in < ts_old then
      merged := jsonb_set(merged, array[k], coalesce(oldj->k, 'null'::jsonb));
    elsif ts_in > ts_old then
      ts := jsonb_set(ts, array[k], to_jsonb(ts_in));
    end if;
  end loop;
  new := jsonb_populate_record(new, merged);
  new.field_ts := ts;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end $$;

-- ---------- sync log (AFTER INSERT/UPDATE) ----------
create or replace function planner_log_change() returns trigger
language plpgsql security definer as $$
declare rid text;
begin
  if tg_table_name = 'planner_exceptions' then
    rid := new.series_id::text || '|' || new.occurrence_date::text;
  elsif tg_table_name = 'planner_settings' then
    rid := new.user_id::text;
  else
    rid := new.id::text;
  end if;
  insert into planner_sync_log (user_id, table_name, row_id, op)
  values (new.user_id, tg_table_name, rid, lower(tg_op));
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['planner_categories','planner_tasks','planner_exceptions','planner_settings'] loop
    execute format('drop trigger if exists %I_merge on %I', t, t);
    execute format('create trigger %I_merge before update on %I for each row execute function planner_merge()', t, t);
    execute format('drop trigger if exists %I_log on %I', t, t);
    execute format('create trigger %I_log after insert or update on %I for each row execute function planner_log_change()', t, t);
  end loop;
end $$;

-- ---------- RLS ----------
do $$
declare t text;
begin
  foreach t in array array['planner_categories','planner_tasks','planner_exceptions','planner_settings'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I_own on %I', t, t);
    execute format('create policy %I_own on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
  end loop;
end $$;
alter table planner_sync_log enable row level security;
drop policy if exists planner_sync_log_own on planner_sync_log;
create policy planner_sync_log_own on planner_sync_log for select to authenticated using (user_id = auth.uid());

-- realtime on the log (live pulls)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table planner_sync_log;
  end if;
exception when duplicate_object then null; end $$;

-- tombstone purge (30 days) — only where pg_cron is installed
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('planner_purge_tombstones', '15 4 * * *', $sql$
      delete from planner_exceptions where deleted_at < now() - interval '30 days';
      delete from planner_tasks      where deleted_at < now() - interval '30 days';
      delete from planner_categories where deleted_at < now() - interval '30 days';
      delete from planner_sync_log   where at < now() - interval '60 days';
    $sql$);
  end if;
end $$;
