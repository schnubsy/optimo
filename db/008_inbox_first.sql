-- 008_inbox_first.sql — optimo arc 7 slice 7: inbox-first data (capture → process → paint).
-- Additive only: three defaulted columns on planner_tasks, no backfill UPDATE, no trigger, policy or grant change
-- (the new columns ride the table's existing grants and RLS policies). Idempotent: safe to run twice.
--
-- A task's PLACE is derived, never stored twice (ARC.md arc 7 RULE; client: src/data/place.ts taskKind):
--   start_at set            ⇒ scheduled (on the timeline; series / override rows as before)
--   else someday = true     ⇒ Someday (no day yet, parked)
--   else plan_date set      ⇒ "to place" on that day (planned, untimed)
--   else                    ⇒ Inbox
-- Moving between places clears the fields that no longer apply, and the client stamps start_at / plan_date / someday
-- together in field_ts, so one place decision wins as a unit under field-level LWW.
--
-- `estimated` = false means "no estimate yet": capture is frictionless, so duration_min still holds the default
-- (settings.default_duration) used when the task is painted, but the UI may show it as unestimated. Existing rows
-- get the column default (true): every row written before 008 had a duration chosen in the editor.
--
-- No CHECK (not (someday and plan_date is not null)): planner_merge() arbitrates each column on its own field_ts, so a
-- check spanning two columns could reject a legitimate merge of two devices' edits (e.g. an old client) and wedge
-- that device's outbox forever. The derived rule above resolves any mix instead (someday wins over plan_date).
--
-- planner_merge() (db/001) loops over jsonb_object_keys(to_jsonb(old)) — every column of the row, skipping only
-- id/user_id/version/updated_at/field_ts/series_id/occurrence_date — so plan_date, someday and estimated merge
-- field-level by their field_ts keys like any other column, with no change to the function. A client that predates
-- 008 never sends them: field_ts has no key ⇒ ts 0 ⇒ the stored value is kept.

begin;

alter table public.planner_tasks
  add column if not exists plan_date date null,
  add column if not exists someday boolean not null default false,
  add column if not exists estimated boolean not null default true;

comment on column public.planner_tasks.plan_date is
  'Day the task is planned for, untimed ("to place"); only meaningful while start_at is null and someday is false. optimo arc 7 (db/008).';
comment on column public.planner_tasks.someday is
  'Parked with no day (Someday); only meaningful while start_at is null. optimo arc 7 (db/008).';
comment on column public.planner_tasks.estimated is
  'false = no estimate yet (duration_min holds the default used when painting). optimo arc 7 (db/008).';

commit;

-- Postconditions (run after applying):
--   select column_name, data_type, is_nullable, column_default from information_schema.columns
--    where table_schema = 'public' and table_name = 'planner_tasks' and column_name in ('plan_date', 'someday', 'estimated')
--    order by column_name;            -- estimated | boolean | NO | true · plan_date | date | YES | null · someday | boolean | NO | false
--   select max(version) from public.planner_tasks;                                                   -- unchanged
--   select count(*) from public.planner_tasks where plan_date is not null or someday or not estimated; -- 0 right after apply
