-- 002_calendar_push.sql — optimo arc 2: iCloud (CalDAV) read-only calendar cache + web push.
-- Cowork applied it via its Supabase connector on 2026-09-27 (arc-2 prep).
-- Secrets never touch these tables in clear: `secret_enc` is AES-GCM ciphertext produced by the
-- `calendar-connect` Edge Function with the PLANNER_KEK secret; the client never stores the password.

-- ---------- calendar accounts (iCloud CalDAV) ----------
create table if not exists planner_calendar_accounts (
  id             uuid primary key,
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider       text not null check (provider in ('icloud')),
  label          text not null default 'iCloud',
  username       text not null,                 -- Apple ID email
  secret_enc     text not null,                 -- base64 AES-GCM(app-specific password), server-side only
  principal_url  text,
  calendars      jsonb not null default '[]'::jsonb,  -- [{href,name,color,enabled}]
  enabled        boolean not null default true,
  last_sync_at   timestamptz,
  last_error     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------- event cache (server-owned; clients read via the sync log) ----------
create table if not exists planner_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null,
  account_id     uuid not null references planner_calendar_accounts(id) on delete cascade,
  calendar_href  text not null,
  uid            text not null,
  etag           text,
  title          text not null default '',
  location       text,
  start_at       timestamptz not null,
  end_at         timestamptz not null,
  all_day        boolean not null default false,
  status         text,
  color          text,
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  unique (account_id, calendar_href, uid)
);
create index if not exists planner_events_user_start_idx on planner_events (user_id, start_at) where deleted_at is null;

-- ---------- web push ----------
create table if not exists planner_push_subscriptions (
  endpoint       text primary key,
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  p256dh         text not null,
  auth           text not null,
  ua             text,
  created_at     timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  disabled_at    timestamptz
);

create table if not exists planner_reminder_sent (
  task_id          uuid not null references planner_tasks(id) on delete cascade,
  occurrence_date  date not null,
  minutes_before   integer not null,
  user_id          uuid not null,
  sent_at          timestamptz not null default now(),
  primary key (task_id, occurrence_date, minutes_before)
);

-- ---------- sync-log fan-out for events (clients pull like any planner_* row) ----------
drop trigger if exists planner_events_log on planner_events;
create trigger planner_events_log after insert or update on planner_events
  for each row execute function planner_log_change();

-- ---------- RLS ----------
alter table planner_calendar_accounts enable row level security;
drop policy if exists planner_calendar_accounts_own on planner_calendar_accounts;
-- clients may read (minus the secret via a view) and delete/toggle; inserts/updates of secret_enc go through the Edge Function (service role)
create policy planner_calendar_accounts_own on planner_calendar_accounts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table planner_events enable row level security;
drop policy if exists planner_events_own on planner_events;
create policy planner_events_own on planner_events for select to authenticated using (user_id = auth.uid());

alter table planner_push_subscriptions enable row level security;
drop policy if exists planner_push_subscriptions_own on planner_push_subscriptions;
create policy planner_push_subscriptions_own on planner_push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table planner_reminder_sent enable row level security;
drop policy if exists planner_reminder_sent_own on planner_reminder_sent;
create policy planner_reminder_sent_own on planner_reminder_sent for select to authenticated using (user_id = auth.uid());

-- secret-free view for the client
create or replace view planner_calendar_accounts_public with (security_invoker = true) as
  select id, user_id, provider, label, username, calendars, enabled, last_sync_at, last_error, created_at, updated_at
  from planner_calendar_accounts;
grant select on planner_calendar_accounts_public to authenticated;
-- and hide the ciphertext column from the API role entirely (column grants are additive, so revoke the table then re-grant columns)
revoke select on planner_calendar_accounts from authenticated, anon;
grant select (id, user_id, provider, label, username, calendars, enabled, last_sync_at, last_error, created_at, updated_at)
  on planner_calendar_accounts to authenticated;
grant update (label, calendars, enabled) on planner_calendar_accounts to authenticated;
grant delete on planner_calendar_accounts to authenticated;

-- tombstone purge: extend the nightly job (idempotent re-schedule)
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('planner_purge_tombstones', '15 4 * * *', $sql$
      delete from planner_exceptions where deleted_at < now() - interval '30 days';
      delete from planner_tasks      where deleted_at < now() - interval '30 days';
      delete from planner_categories where deleted_at < now() - interval '30 days';
      delete from planner_events     where deleted_at < now() - interval '30 days';
      delete from planner_reminder_sent where sent_at < now() - interval '30 days';
      delete from planner_sync_log   where at < now() - interval '60 days';
    $sql$);
  end if;
end $$;
