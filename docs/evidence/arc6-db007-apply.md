# db/007_task_tz.sql — applied 2026-10-09 by Code via the claude.ai Supabase connector

- Project: `press` (`eepjhpyziczrxvirczio`). Migration name: `optimo_007_task_tz`, version **20261009181817**.
- File: `db/007_task_tz.sql`, `git hash-object` = **48a493cf9620abf14ef693580ae19470267b9336** — applied unchanged (the
  connector query was the file's bytes). Parses with libpg-query (`tests/unit/sql.test.ts`).
- Additive only (RULE, arc 6): one nullable column with a length check; no backfill, no trigger/policy change, no
  destructive statement.

| check | before | after |
|---|---|---|
| `information_schema.columns` planner_tasks.tz | absent (0) | `tz` · `text` · nullable `YES` |
| `select max(version) from planner_tasks` | 9 | **9** (unchanged — no row touched) |
| `count(*) where tz is not null` | — | 0 |
| `list_migrations` tail | `optimo_006_people` (20261004003931) | `optimo_007_task_tz` (20261009181817) |

Client: Dexie v4 (no new index), `Task.tz`, the sync engine pushes/pulls it like any column (planner_merge() is
generic over keys), spec §2.1 + §5.1 updated.
