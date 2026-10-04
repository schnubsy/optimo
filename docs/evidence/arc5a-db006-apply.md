# Arc 5a — db/006 apply + calendar function redeploy (2026-10-03, Claude Code)

Done by Code via the claude.ai Supabase connector (project `eepjhpyziczrxvirczio`), Mark confirming the pop-ups.
Closes HANDOFF "Mark's manual steps" 1–2.

## Precondition
| Check | Result |
|---|---|
| `git pull --ff-only` | main = origin/main = `e3d16ce` |
| `git hash-object db/006_people.sql` | `d9261803e1f4f718b9d01a14dbdb1040c3a36a0d` ✅ |
| `select max(version) from planner_tasks` | 9 |
| `planner_people` exists | no (0) |
| `grep -c "accounts: results, events, pushed" supabase/functions/_shared/handlers.ts` | 1 ✅ |

## db/006 — applied unchanged
`apply_migration` name `optimo_006_people` → `{"success":true}`; `supabase_migrations.schema_migrations` version
`20261004003931`. Body = the file verbatim (header comments + foot included).

Postconditions (the queries at the foot of db/006):
| Check | Expect | Result |
|---|---|---|
| Mark person (`5eed…a4c0`, `created_by` not null) | 1 | 1 ✅ |
| `person_id is null` — tasks / categories / settings / events / sync_log | 0 each | 0 / 0 / 0 / 0 / 0 ✅ |
| Mark's tasks without a person | 0 | 0 ✅ |
| `planner_flags.family_access` | false | false ✅ |
| `max(version)` on planner_tasks | 9 (unchanged) | 9 ✅ |
| `*_person` BEFORE INSERT triggers | 12 | 12 ✅ |
| planner_* triggers left disabled by the backfill | 0 | 0 ✅ |

Security advisors, before → after (planner_* only):
- **New:** `planner_family_access()` is a SECURITY DEFINER function callable by `authenticated` (WARN 0029). That's
  by design: the `*_family` RLS policies call it, and it only returns the flag AND `press_access_has('optimo.html')`.
  It has the same shape as `press_access_has`, which is already listed. db/006 revokes it from `anon`/`public`.
- **Cleared:** `planner_log_change` search_path is mutable (WARN 0011). 006 recreates the function with
  `set search_path = public`.
- **Unchanged:** `planner_merge` search_path is mutable; `planner_log_change` is executable by anon/authenticated
  (both pre-existing).
- **None** of db/006's own criteria were hit: no "RLS disabled" finding and no anon-executable definer finding on any new object.

## Edge — calendar-sync + calendar-connect
Bundle per function: `calendar-*/index.ts` + `deno.json` + `_shared/{caldav,crypto,due,handlers,ics,supabase,twoway,vevent}.ts`
(the same layout as the live v3 version: entry `calendar-*/index.ts`, import map `deno.json`).

| Function | verify_jwt | Version | ezbr_sha256 before → after | Read-back vs repo |
|---|---|---|---|---|
| calendar-sync | false | 3 → 4 | `4fa36d951fd1e4bc19f39c14b4f8b537d9418808dc0782031405f1e9b50d479b` → `3ee448f2a3f65eb68dcfb9356ea5356b34b0db68c6ac7ea2c80b764fb6b4d96d` | 10/10 files byte-identical ✅ |
| calendar-connect | true | 3 → 4 | `b3532d49665747cd74112ebd5f3b4e72cfc7e92a0db15411b3c02e4c2de649de` → `27d97ea75c9738cbe46b4d35b745695831e2b754b81726e74c47cada4ba1fe26` | 10/10 files byte-identical ✅ |

A real sync answers with top-level counts. This is the pg_cron job `planner_calendar_sync` (`*/15`), read from
`net._http_response`. No user JWT or cron secret was handled.
- 00:30 UTC (old v3 code): `200 {"accounts":[…]}` — no top-level counts.
- **00:45 UTC (v4, deployed 00:42:44): `200 {"accounts":[{…"calendars":4,"events":12,…}],"events":12,"pushed":0}`** ✅
- Account `982cc59b…`: `last_error` null, `last_sync_at` 00:45:02, `person_id` = Mark; sync_log has 0 rows with a null person (89 total);
  `max(version)` is still 9.

Not covered here: a sync started from optimo's own button (Mark's on-device step 4).
