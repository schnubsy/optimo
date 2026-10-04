-- 004_ai.sql — optimo arc 3: AI planning layer. Cowork applied it via its Supabase connector AFTER the arc-3
-- merge (HANDOFF "Mark's manual steps"); Code committed this file unchanged. Idempotent.
-- Both tables speak the sync contract (spec §5): sync cols + planner_merge + planner_log_change + own-row RLS.

-- One row per plan request (intent → proposal). mode: propose (default) | auto (writes tasks straight in).
create table if not exists planner_ai_plans (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  plan_date   date not null,
  intent      text not null,
  mode        text not null default 'propose' check (mode in ('propose','auto')),
  status      text not null default 'draft' check (status in ('draft','accepted','rejected','applied','failed')),
  proposal    jsonb not null default '{}'::jsonb,   -- { blocks:[{title,start_at,duration_min,category_id?,priority?,why}], questions:[], notes }
  research    jsonb not null default '[]'::jsonb,   -- [{query,url,title,snippet}] from web search
  model       text,
  accepted_task_ids uuid[] not null default '{}',
  version     bigint not null default 1,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  field_ts    jsonb not null default '{}'::jsonb,
  device_id   text
);
create index if not exists planner_ai_plans_user_date on planner_ai_plans (user_id, plan_date);

-- Learned planning style (one row per user), distilled from accepted/edited plans.
create table if not exists planner_ai_profile (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,   -- { tone, day_shape, preferred_block_min, buffers, habits:[], avoid:[] }
  accepted_count int not null default 0,
  version     bigint not null default 1,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  field_ts    jsonb not null default '{}'::jsonb,
  device_id   text
);

do $$
declare t text;
begin
  foreach t in array array['planner_ai_plans','planner_ai_profile'] loop
    execute format('drop trigger if exists %I_merge on %I', t, t);
    execute format('create trigger %I_merge before update on %I for each row execute function planner_merge()', t, t);
    execute format('drop trigger if exists %I_log on %I', t, t);
    execute format('create trigger %I_log after insert or update on %I for each row execute function planner_log_change()', t, t);
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I_own on %I', t, t);
    execute format('create policy %I_own on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
  end loop;
end $$;

grant select, insert, update, delete on public.planner_ai_plans to authenticated, service_role;
grant select, insert, update, delete on public.planner_ai_profile to authenticated, service_role;
