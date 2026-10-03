-- 005_calendar_twoway.sql — optimo arc 4: iCloud two-way sync + calendar picker.
-- Applied by Cowork's Supabase connector on 2026-10-03 BEFORE the arc-4 order; Code commits it unchanged. Idempotent.

-- the one calendar optimo writes timed tasks into (null = write-back off)
alter table planner_calendar_accounts add column if not exists write_calendar_href text;

create or replace view planner_calendar_accounts_public with (security_invoker = true) as
  select id, user_id, provider, label, username, calendars, enabled, last_sync_at, last_error, created_at, updated_at,
         write_calendar_href
  from planner_calendar_accounts;
grant select on planner_calendar_accounts_public to authenticated;
grant select (write_calendar_href) on planner_calendar_accounts to authenticated;
grant update (write_calendar_href) on planner_calendar_accounts to authenticated;

-- task ↔ iCloud event link (server-owned; written by calendar-sync with the service role)
create table if not exists planner_calendar_links (
  task_id        uuid primary key references planner_tasks(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  account_id     uuid not null references planner_calendar_accounts(id) on delete cascade,
  calendar_href  text not null,
  object_href    text not null,           -- the .ics resource optimo PUT
  uid            text not null,           -- optimo-<task_id>@optimo
  etag           text,                    -- last etag seen/written (detects edits made in iCloud)
  pushed_version bigint not null default 0, -- planner_tasks.version last written to iCloud
  pushed_at      timestamptz not null default now(),
  unique (account_id, uid)
);
alter table planner_calendar_links enable row level security;
create policy planner_calendar_links_own on planner_calendar_links for select to authenticated using (user_id = auth.uid());
grant select on public.planner_calendar_links to authenticated;
grant select, insert, update, delete on public.planner_calendar_links to service_role;
