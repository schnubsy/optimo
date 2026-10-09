-- 007_task_tz.sql — optimo arc 6 slice 7: an optional per-task time zone (the wizard's "Set Timezone").
-- Additive only: one nullable column, no backfill, no trigger or policy change. A task without tz keeps today's meaning
-- (its wall-clock time is the viewer's zone). With tz, start_at is still the UTC instant; tz records the zone the user
-- set the wall-clock time in, so the editor can show and edit it there while the timeline converts to the device zone.
-- planner_merge() merges every column generically (field_ts per key), so tz syncs field-level like any other field.
-- Idempotent: safe to run twice.

begin;

alter table public.planner_tasks
  add column if not exists tz text check (tz is null or length(btrim(tz)) between 1 and 64);

comment on column public.planner_tasks.tz is
  'IANA time zone the task''s wall-clock time is kept in (null = the viewer''s zone). optimo arc 6 (db/007).';

commit;

-- Postconditions (run after applying):
--   select column_name, data_type, is_nullable from information_schema.columns
--    where table_schema = 'public' and table_name = 'planner_tasks' and column_name = 'tz';   -- tz | text | YES
--   select max(version) from public.planner_tasks;                                             -- unchanged
--   select count(*) from public.planner_tasks where tz is not null;                            -- 0 right after apply
