# ai-planner slice 11 — data layer: planner_ai_plans + planner_ai_profile on the device

- `db/004_ai.sql` committed **unchanged** (git hash-object `2e019b196e05…` = the inbox hash). Code never applies it.
- Dexie `version(3)`: `aiPlans: 'id, plan_date'`, `aiProfile: 'id'` (`src/data/db.ts`). Types `AiPlan`,
  `AiProfile`, `AiBlock`, `AiSource` (`src/data/types.ts`). `TableName` / `REMOTE_TABLE` gain both tables.
- Sync (`src/sync/engine.ts`): both tables join the push order and the pull (same field-level LWW `mergeRow` as
  every table, spec §5). `CONFLICT` = `id`.
- **Degrade cleanly:** `OPTIONAL_TABLES`. A push answered with PGRST205 / 42P01 (004 not applied yet) *parks* that
  table's outbox rows. They are kept and retried every cycle. Those rows don't count as pending, so the badge stays
  "synced", and the core tables push as usual.
- Repo (`src/data/repo.ts`): `updateAiPlan` (status / accepted_task_ids) and `resetAiProfile` (tombstone). Both
  use the usual `stampRow` + outbox in one transaction.
- Spec §3 (arc 3 paragraph) and §5.1 (both tables, optional-table rule) updated.

Tests (`tests/unit/ai.test.ts`, 6):
- Dexie v3 stores and `fromRemote` shape.
- A local accept round-trips through the outbox and survives a stale server echo (LWW); a newer server proposal
  merges field by field.
- Profile pull, then Reset → tombstone through the outbox.
- `isMissingTable`.
- Degrade: AI pushes park, tasks push, pending = 0; once 004 is applied the parked row goes up and parking clears.

Perf budget unchanged at 5k tasks (desktop, this gauntlet):
```
|---|---|---|---|
| day view ready after data (max of 6 day switches) | 9.5 ms | < 200 ms | 🟢 |
| inbox filter → rendered (max of 4 queries over 1262 items, 937h45) | 1.4 ms | < 50 ms | 🟢 |
| drag: 60 pointer moves, long tasks > 50 ms | 0 | 0 | 🟢 |
| drag moves the slab by transform only | yes | yes | 🟢 |
```

Gauntlet `ai-planner-slice-11` (20261003-040445): GREEN. vitest 339 · deno · Playwright 182 · Lighthouse 100/100 · 98/100.
