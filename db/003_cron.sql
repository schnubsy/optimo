-- 003_cron.sql — optimo arc 2: pg_cron drives the Edge Functions. Applied by Cowork's Supabase connector AFTER the
-- Edge Function secrets exist and push-send / calendar-sync are deployed (HANDOFF "Mark's manual steps").
-- Code never applies DDL. Idempotent: re-running re-schedules the same two jobs.
--
-- Precondition (a separate, guarded step — the secret value is never committed):
--   select vault.create_secret('<CRON_SECRET from .secrets/planner.env>', 'planner_cron_secret');
-- pg_cron + pg_net + vault are present on press (verified 2026-09-27).

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'planner_cron_secret') then
    raise exception 'vault secret planner_cron_secret is missing — create it first (see the header of this file)';
  end if;
end $$;

-- every minute: web push for reminders due in the next 60 s
select cron.schedule(
  'planner_push_send',
  '* * * * *',
  $cron$
  select net.http_post(
    url     := 'https://eepjhpyziczrxvirczio.supabase.co/functions/v1/push-send',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'planner_cron_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $cron$
);

-- every 15 minutes: refresh every enabled iCloud account server-side (clients pull through planner_sync_log)
select cron.schedule(
  'planner_calendar_sync',
  '*/15 * * * *',
  $cron$
  select net.http_post(
    url     := 'https://eepjhpyziczrxvirczio.supabase.co/functions/v1/calendar-sync',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'planner_cron_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $cron$
);
