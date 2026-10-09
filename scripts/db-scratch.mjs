// scripts/db-scratch.mjs — prove a db/*.sql migration against a throwaway Postgres (PGlite: real Postgres in WASM,
// no server, no network). It never touches `press`; this is the "runs clean twice" proof for db/006.
//   1. Supabase-shaped stubs: roles anon/authenticated/service_role, auth.users, auth.uid(), auth.jwt(),
//      press_access_has(page) (granted when the JWT email is in a stub grant list — same opt-out shape as press);
//   2. db/001, 002, 004, 005 as applied today (003 is pg_cron/vault only — skipped);
//   3. arc-5a-era data written the way the client writes it (authenticated role, RLS on, upserts);
//   4. db/006 applied TWICE; then the arc-5a client's writes again, the flag off/on, and the people policies.
//   8. (arc 7) db/007 + db/008 applied TWICE on top: defaults on existing rows, no version bump / sync-log rows,
//      field-level merge of plan_date / someday / estimated, a pre-008 client's upsert keeps them, no wedging check.
// Usage: PGLITE=<dir containing node_modules/@electric-sql/pglite> node scripts/db-scratch.mjs > docs/evidence/…txt
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const req = createRequire(join(process.env.PGLITE ?? ROOT, 'package.json'))
const { PGlite } = await import(pathToFileURL(req.resolve('@electric-sql/pglite')).href)
const { pgcrypto } = await import(pathToFileURL(req.resolve('@electric-sql/pglite/contrib/pgcrypto')).href)

const MARK = '00000000-0000-4000-8000-0000000000aa'
const BARB = '00000000-0000-4000-8000-0000000000bb'
const OUTSIDER = '00000000-0000-4000-8000-0000000000cc'
const MARK_PERSON = '5eed0000-0000-4000-8000-00000000a4c0'
const T1 = '0190b000-0000-7000-8000-000000000001'
const C1 = '0190b000-0000-7000-8000-0000000000c1'

const db = new PGlite({ extensions: { pgcrypto } })
let failures = 0
const log = (...a) => console.log(...a)
const ok = (cond, msg) => {
  log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!cond) failures++
}
const one = async (sql, params) => (await db.query(sql, params)).rows[0]
const val = async (sql, params) => Object.values((await one(sql, params)) ?? {})[0]

async function as(user, email, fn) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ sub: user, email, role: 'authenticated' })}', false);`)
  try {
    return await fn()
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`)
  }
}

// ---------- 1. Supabase-shaped stubs ----------
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub', '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  -- press access (stub with the real signature): active family people, opt-out grants
  create table public.press_stub_people (email text primary key);
  create function public.press_access_has(page text) returns boolean language sql stable security definer set search_path = '' as $$
    select page = 'optimo.html' and exists (select 1 from public.press_stub_people p where p.email = (select auth.jwt() ->> 'email')) $$;
  grant execute on function public.press_access_has(text) to authenticated;
  insert into auth.users values ('${MARK}', 'markgubb@gmail.com'), ('${BARB}', 'barb@family.example'), ('${OUTSIDER}', 'someone@else.example');
  insert into public.press_stub_people values ('markgubb@gmail.com'), ('barb@family.example');
`)

// ---------- 2. today's schema ----------
for (const f of ['001_planner.sql', '002_calendar_push.sql', '004_ai.sql', '005_calendar_twoway.sql']) {
  try {
    await db.exec(readFileSync(join(ROOT, 'db', f), 'utf8'))
  } catch (e) {
    console.error(`db/${f}: ${e.message}`)
    process.exit(2)
  }
  log(`applied db/${f}`)
}

// ---------- 3. arc-5a-era data, written like the client writes it ----------
const clientWrites = async (user, email, ids) =>
  as(user, email, async () => {
    await db.query(
      `insert into planner_categories (id, name, field_ts) values ($1, 'Work', '{"name":1}')
       on conflict (id) do update set name = excluded.name, field_ts = excluded.field_ts`,
      [ids.cat],
    )
    await db.query(
      `insert into planner_tasks (id, title, start_at, duration_min, category_id, field_ts) values ($1, 'Standup', now(), 15, $2, '{"title":1,"start_at":1}')
       on conflict (id) do update set title = excluded.title, field_ts = excluded.field_ts`,
      [ids.task, ids.cat],
    )
    await db.query(
      `insert into planner_settings (data, field_ts) values ('{"snap":5}', '{"data":1}')
       on conflict (user_id) do update set data = excluded.data, field_ts = excluded.field_ts`,
    )
    await db.query(
      `insert into planner_exceptions (series_id, occurrence_date, skipped, field_ts) values ($1, current_date, true, '{"skipped":1}')
       on conflict (series_id, occurrence_date) do update set skipped = excluded.skipped`,
      [ids.task],
    )
    await db.query(
      `insert into planner_ai_profile (data, field_ts) values ('{"tone":"calm"}', '{"data":1}')
       on conflict (user_id) do update set data = excluded.data`,
    )
  })
await clientWrites(MARK, 'markgubb@gmail.com', { task: T1, cat: C1 })
// a second family account that already used optimo before 006 (must not be handed to Mark, must not collide)
await clientWrites(BARB, 'barb@family.example', { task: '0190b000-0000-7000-8000-0000000000b0', cat: '0190b000-0000-7000-8000-0000000000b3' })
// server-owned rows (Edge Functions write these with the service role)
await db.exec(`
  insert into planner_calendar_accounts (id, user_id, provider, username, secret_enc, calendars, write_calendar_href)
    values ('0190b000-0000-7000-8000-0000000000a1', '${MARK}', 'icloud', 'mark@icloud.example', 'ciphertext', '[{"href":"/cal/optimo/","name":"Optimo","enabled":true}]', '/cal/optimo/');
  insert into planner_events (user_id, account_id, calendar_href, uid, title, start_at, end_at)
    values ('${MARK}', '0190b000-0000-7000-8000-0000000000a1', '/cal/family/', 'e1', 'Dentist', now(), now() + interval '1 hour');
  insert into planner_calendar_links (task_id, user_id, account_id, calendar_href, object_href, uid)
    values ('${T1}', '${MARK}', '0190b000-0000-7000-8000-0000000000a1', '/cal/optimo/', '/cal/optimo/optimo-x.ics', 'optimo-x@optimo');
  insert into planner_push_subscriptions (endpoint, user_id, p256dh, auth) values ('https://push.example/1', '${MARK}', 'k', 'a');
  insert into planner_reminder_sent (task_id, occurrence_date, minutes_before, user_id) values ('${T1}', current_date, 10, '${MARK}');
`)
const before = {
  version: await val(`select max(version) from planner_tasks`),
  log: await val(`select count(*)::int from planner_sync_log`),
  markLog: await val(`select count(*)::int from planner_sync_log where user_id = $1`, [MARK]),
  updated: await val(`select max(updated_at)::text from planner_tasks`),
}
log(`pre-006: tasks max(version)=${before.version}, sync_log rows=${before.log}`)

// ---------- 4. db/006 twice ----------
const m006 = readFileSync(join(ROOT, 'db', '006_people.sql'), 'utf8')
for (const run of [1, 2]) {
  try {
    await db.exec(m006)
    ok(true, `db/006 run ${run} applied clean`)
  } catch (e) {
    ok(false, `db/006 run ${run}: ${e.message}`)
  }
}

ok((await val(`select count(*)::int from planner_people`)) === 1, 'exactly one person after two runs (Mark, idempotent seed)')
ok((await val(`select created_by::text from planner_people where id = $1`, [MARK_PERSON])) === MARK, "Mark's person is created_by Mark's auth user")
const TABLES = ['planner_tasks', 'planner_categories', 'planner_settings', 'planner_ai_profile', 'planner_ai_plans', 'planner_exceptions',
  'planner_calendar_accounts', 'planner_calendar_links', 'planner_events', 'planner_push_subscriptions', 'planner_reminder_sent', 'planner_sync_log']
for (const t of TABLES) {
  const r = await one(`select count(*) filter (where user_id = $2)::int as n, count(*) filter (where person_id = $1)::int as mark,
                              count(*) filter (where user_id <> $2 and person_id is not null)::int as other from ${t}`, [MARK_PERSON, MARK])
  ok(r.n === r.mark && r.other === 0, `${t}: all ${r.n} of Mark's existing rows → Mark; other accounts' rows left unassigned`)
}
ok((await val(`select max(version) from planner_tasks`)) === before.version, 'backfill fired no merge trigger (version unchanged)')
ok((await val(`select max(updated_at)::text from planner_tasks`)) === before.updated, 'backfill left updated_at alone')
ok((await val(`select count(*)::int from planner_sync_log`)) === before.log, 'backfill wrote no sync-log rows')
ok((await val(`select value from planner_flags where key = 'family_access'`)) === false, 'family_access flag starts off')
const triggersOn = await val(`select count(*)::int from pg_trigger where not tgisinternal and tgenabled = 'D'`)
ok(triggersOn === 0, 'every trigger re-enabled after the backfill')

// ---------- 5. the arc-5a client keeps working ----------
const T2 = '0190b000-0000-7000-8000-000000000002'
await as(MARK, 'markgubb@gmail.com', async () => {
  await db.query(`insert into planner_tasks (id, title, field_ts) values ($1, 'New after 006', '{"title":5}') on conflict (id) do update set title = excluded.title, field_ts = excluded.field_ts`, [T2])
  await db.query(`insert into planner_tasks (id, title, field_ts) values ($1, 'Standup v2', '{"title":9}') on conflict (id) do update set title = excluded.title, field_ts = excluded.field_ts`, [T1])
  await db.query(`insert into planner_settings (data, field_ts) values ('{"snap":10}', '{"data":9}') on conflict (user_id) do update set data = excluded.data, field_ts = excluded.field_ts`)
  const t2 = await one(`select person_id::text, version from planner_tasks where id = $1`, [T2])
  ok(t2?.person_id === MARK_PERSON, 'arc-5a insert without person_id → filled with Mark')
  const t1 = await one(`select title, version, person_id::text from planner_tasks where id = $1`, [T1])
  ok(t1.title === 'Standup v2' && Number(t1.version) === Number(before.version) + 1 && t1.person_id === MARK_PERSON, 'arc-5a upsert on an existing row merges (LWW), bumps version, keeps person')
  ok((await val(`select data->>'snap' from planner_settings`)) === '10', 'planner_settings upsert on_conflict=user_id still works')
  const lg = await one(`select person_id::text from planner_sync_log where row_id = $1 order by seq desc limit 1`, [T1])
  ok(lg?.person_id === MARK_PERSON, 'sync-log rows now carry the person')
  ok((await val(`select count(*)::int from planner_sync_log`)) === before.markLog + 3, "Mark's own sync-log pull: his old rows + the 3 new writes, nobody else's")
})

// ---------- 6. family access: inert until the flag, then live; never for outsiders ----------
const barbSeesMark = () => as(BARB, 'barb@family.example', () => val(`select count(*)::int from planner_tasks where user_id = $1`, [MARK]))
const barbPre = await val(`select count(*)::int from planner_tasks where user_id = $1`, [BARB])
ok((await barbSeesMark()) === 0, "flag off: a granted family member does NOT see Mark's rows (arc-5a client unaffected)")
await clientWrites(BARB, 'barb@family.example', { task: '0190b000-0000-7000-8000-0000000000b1', cat: '0190b000-0000-7000-8000-0000000000b2' })
ok((await val(`select count(*)::int from planner_tasks where user_id = $1 and person_id is null`, [BARB])) === 2 && barbPre === 1,
  "Barb's arc-5a writes land (person_id null until 5b — no person of hers yet, no unique clash on settings/profile)")
ok((await as(MARK, 'markgubb@gmail.com', () => val(`select count(*)::int from planner_sync_log where user_id = $1`, [BARB]))) === 0,
  "flag off: Mark's unfiltered sync-log pull never sees Barb's log rows")

await db.exec(`update planner_flags set value = true where key = 'family_access'`)
ok((await barbSeesMark()) === 2, 'flag on: family-wide read of Mark-person rows')
const barbEdit = await as(BARB, 'barb@family.example', async () => {
  const r = await db.query(`update planner_tasks set title = 'edited by Barb', field_ts = '{"title":99}' where id = $1`, [T2])
  return r.affectedRows
})
ok(barbEdit === 1, 'flag on: family-wide write')
ok((await as(OUTSIDER, 'someone@else.example', () => val(`select count(*)::int from planner_tasks`))) === 0, 'never for someone without the optimo grant')
await db.exec(`update planner_flags set value = false where key = 'family_access'`)
try {
  await db.exec(m006)
  ok((await val(`select value from planner_flags where key = 'family_access'`)) === false, 'a third run keeps the flag value it finds')
} catch (e) {
  ok(false, `db/006 run 3: ${e.message}`)
}

// ---------- 7. people policies (live now; no 5a client reads them) ----------
const added = await as(BARB, 'barb@family.example', async () => {
  await db.query(`insert into planner_people (name, color) values ('Barb', 'family')`)
  return val(`select count(*)::int from planner_people`)
})
ok(added === 2, 'anyone signed in with optimo can add a person and sees everyone')
ok((await val(`select created_by::text from planner_people where name = 'Barb'`)) === BARB, 'created_by defaults to the adder')
let outsiderBlocked = false
try {
  await as(OUTSIDER, 'someone@else.example', () => db.query(`insert into planner_people (name) values ('Nope')`))
} catch {
  outsiderBlocked = true
}
ok(outsiderBlocked, 'someone without the grant cannot add people')
ok((await as(OUTSIDER, 'someone@else.example', () => val(`select count(*)::int from planner_people`))) === 0, '…or see them')
await as(BARB, 'barb@family.example', () => db.query(`insert into planner_tasks (id, title) values ('0190b000-0000-7000-8000-0000000000b9', 'after Barb has a person')`))
ok((await val(`select p.name from planner_tasks t join planner_people p on p.id = t.person_id where t.id = '0190b000-0000-7000-8000-0000000000b9'`)) === 'Barb',
  "a new row from Barb is filled with Barb's own person once she has one")
ok((await val(`select count(*)::int from information_schema.role_table_grants where table_name = 'planner_people' and grantee = 'anon'`)) === 0, 'no anon grants on planner_people')

// ---------- 8. arc 7: db/007 + db/008 on top of 001–006 ----------
const pre008 = {
  version: await val(`select max(version) from planner_tasks`),
  log: await val(`select count(*)::int from planner_sync_log`),
  rows: await val(`select count(*)::int from planner_tasks`),
}
for (const f of ['007_task_tz.sql', '008_inbox_first.sql']) {
  const sql = readFileSync(join(ROOT, 'db', f), 'utf8')
  for (const run of [1, 2]) {
    try {
      await db.exec(sql)
      ok(true, `db/${f} run ${run} applied clean`)
    } catch (e) {
      ok(false, `db/${f} run ${run}: ${e.message}`)
    }
  }
}
const cols = (await db.query(`select column_name, data_type, is_nullable, column_default from information_schema.columns
  where table_schema = 'public' and table_name = 'planner_tasks' and column_name in ('plan_date', 'someday', 'estimated') order by column_name`)).rows
log(`008 columns: ${cols.map((c) => `${c.column_name} ${c.data_type} null=${c.is_nullable} default=${c.column_default}`).join(' · ')}`)
ok(cols.length === 3 && cols[0].data_type === 'boolean' && cols[0].is_nullable === 'NO' && cols[0].column_default === 'true'
  && cols[1].data_type === 'date' && cols[1].is_nullable === 'YES' && cols[2].column_default === 'false', '008 columns have the documented types / nullability / defaults')
ok((await val(`select count(*)::int from planner_tasks where plan_date is null and not someday and estimated`)) === pre008.rows, 'every existing row reads plan_date null · someday false · estimated true')
ok((await val(`select max(version) from planner_tasks`)) === pre008.version, '007/008 fired no merge trigger (version unchanged)')
ok((await val(`select count(*)::int from planner_sync_log`)) === pre008.log, '007/008 wrote no sync-log rows')
ok((await val(`select count(*)::int from pg_constraint where conrelid = 'public.planner_tasks'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%someday%'`)) === 0,
  'no cross-column check on someday / plan_date (a field-level merge can never be rejected)')

const T3 = '0190b000-0000-7000-8000-000000000003'
const upsertTask = (cols, vals, setCols) => db.query(
  `insert into planner_tasks (id, ${cols.join(', ')}) values ($1, ${cols.map((_, i) => `$${i + 2}`).join(', ')})
   on conflict (id) do update set ${setCols.map((c) => `${c} = excluded.${c}`).join(', ')}`, vals)
await as(MARK, 'markgubb@gmail.com', async () => {
  // capture on device A (arc-7 client): inbox, no estimate
  await upsertTask(['title', 'plan_date', 'someday', 'estimated', 'field_ts'], [T3, 'Captured', null, false, false, '{"title":10,"plan_date":10,"someday":10,"estimated":10}'],
    ['title', 'plan_date', 'someday', 'estimated', 'field_ts'])
  // device A plans it for a day (place fields stamped together at 20)
  await upsertTask(['plan_date', 'someday', 'start_at', 'field_ts'], [T3, '2026-10-12', false, null, '{"title":10,"plan_date":20,"someday":20,"start_at":20,"estimated":10}'],
    ['plan_date', 'someday', 'start_at', 'field_ts'])
  let r = await one(`select plan_date::text, someday, estimated, version from planner_tasks where id = $1`, [T3])
  ok(r.plan_date === '2026-10-12' && r.someday === false && r.estimated === false && Number(r.version) === 2, 'planForDay upsert merges: plan_date lands, version bumps')
  // device B moved it to Someday EARLIER (ts 15) and arrives late: loses both place fields as a unit
  await upsertTask(['plan_date', 'someday', 'start_at', 'field_ts'], [T3, null, true, null, '{"plan_date":15,"someday":15,"start_at":15}'], ['plan_date', 'someday', 'start_at', 'field_ts'])
  r = await one(`select plan_date::text, someday, (field_ts->>'someday')::int as ts from planner_tasks where id = $1`, [T3])
  ok(r.plan_date === '2026-10-12' && r.someday === false && r.ts === 20, 'an older place decision loses field-level (plan_date kept, someday stays false)')
  // a mixed merge (someday from one device, plan_date from another) is accepted — no check wedges the push
  await upsertTask(['someday', 'field_ts'], [T3, true, '{"someday":30}'], ['someday', 'field_ts'])
  r = await one(`select plan_date::text, someday from planner_tasks where id = $1`, [T3])
  ok(r.plan_date === '2026-10-12' && r.someday === true, 'a field-level mix (someday + plan_date) is stored; the client derives Someday')
  // setEstimate
  await upsertTask(['duration_min', 'estimated', 'field_ts'], [T3, 60, true, '{"duration_min":40,"estimated":40}'], ['duration_min', 'estimated', 'field_ts'])
  r = await one(`select duration_min, estimated from planner_tasks where id = $1`, [T3])
  ok(r.duration_min === 60 && r.estimated === true, 'estimated merges like any field')
  // a pre-008 client (doesn't know the columns) edits the title: the 008 fields are untouched
  await upsertTask(['title', 'field_ts'], [T3, 'Captured (renamed on an old client)', '{"title":50}'], ['title', 'field_ts'])
  r = await one(`select title, plan_date::text, someday, estimated, field_ts from planner_tasks where id = $1`, [T3])
  ok(r.title === 'Captured (renamed on an old client)' && r.plan_date === '2026-10-12' && r.someday === true && r.estimated === true && r.field_ts.plan_date === 20,
    "a pre-008 client's upsert keeps plan_date / someday / estimated and their field_ts")
  // a bad plan_date is rejected by the column type (the client only ever sends YYYY-MM-DD)
  let rejected = false
  try {
    await upsertTask(['plan_date', 'field_ts'], [T3, 'next tuesday', '{"plan_date":60}'], ['plan_date', 'field_ts'])
  } catch {
    rejected = true
  }
  ok(rejected, "plan_date is a real date: 'next tuesday' is rejected")
  ok((await val(`select count(*)::int from planner_sync_log where row_id = $1`, [T3])) === 6, 'every accepted write logged once for the pull')
})

log(failures ? `\nRESULT: RED (${failures} failed)` : '\nRESULT: GREEN')
process.exit(failures ? 1 : 0)
