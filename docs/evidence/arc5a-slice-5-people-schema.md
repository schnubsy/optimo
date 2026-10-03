# arc 5a · slice 5 — people schema draft (B2) — `db/006_people.sql`, WRITTEN, NOT applied

`git hash-object db/006_people.sql` = `d9261803e1f4f718b9d01a14dbdb1040c3a36a0d`. Cowork applies it (HANDOFF manual step 1).

## What it does (additive; the arc-5a client is unaware of people)
- `planner_people (id, name, color, sort_key, created_by, created_at, deleted_at)`.
  - Seeds "Mark" at the fixed id `5eed0000-0000-4000-8000-00000000a4c0`, `created_by` = Mark's auth user.
  - Policy `planner_people_family`: anyone with `press_access_has('optimo.html')` sees and adds people.
  - Data API grants are included; anon gets none.
- `person_id` (nullable, FK, indexed) on 12 tables: tasks, categories, settings, ai_profile, ai_plans, exceptions, calendar_accounts, calendar_links, events, push_subscriptions, reminder_sent, sync_log.
- **Backfill.** Every row of Mark's account → Mark, with the table triggers disabled for the UPDATE. That means no `version` bump, no `updated_at` change, no sync-log rows, and nothing re-pulled. Other accounts' rows stay unassigned.
- **`planner_person_fill`** (BEFORE INSERT) fills in `person_id` when it's missing: the first person created by the row's user. Today's client and Edge writes therefore land on Mark.
- **`planner_log_change`** now stamps `person_id` on sync-log rows. Arc 5b pulls by person.
- **Side-by-side keys** `unique (person_id)` on `planner_settings` and `planner_ai_profile`. The old keys stay: the settings `user_id` PK and the ai_profile `unique (user_id)`. No PK swap, so every arc-5a upsert keeps its `on_conflict`.
- **Family-wide RLS** `*_family` is ADDED beside every `*_own` policy, and is held behind `planner_flags.family_access = false` (via `planner_family_access()`).
  - **Why held:** the 5a client pulls `planner_sync_log` and lists calendar accounts with no user filter, and Family Wing grants are opt-out. Live family policies would pour every member's rows into Mark's device.
  - **When it flips:** arc 5b flips the flag after the person-scoped client ships.

## Deviations from the order (and why)
- Grant key `'optimo.html'`, not `'optimo'`: press keys apps by page file. Ratified in the plan batch.
- "Family-wide access ADDED": the policies are added, but inert until the flag. Making them live now would break the 5a client, which the order forbids.
- "Backfill every existing row to Mark": scoped to Mark's account. Assigning another account's rows would collide on the one-row-per-person keys and give their data to the wrong person. None are expected today.

## Proof — scratch Postgres, run twice (and a third time)
- Harness: `scripts/db-scratch.mjs`, using PGlite (Postgres 17 in WASM, pgcrypto) with Supabase-shaped stubs.
- Sequence: apply 001 + 002 + 004 + 005; write data as Mark *and* as a second family account, the way the client does; then apply 006 twice.
- Raw output: `arc5a-slice-5-db006-scratch.txt`. **39 PASS, RESULT: GREEN.** It checks:
  - clean runs 1, 2 and 3;
  - one person after repeated runs;
  - all 12 tables backfilled for Mark only;
  - version, updated_at and the sync log untouched by the backfill;
  - triggers re-enabled;
  - 5a-style inserts filled with Mark;
  - LWW upserts unchanged;
  - settings upsert on `user_id`;
  - sync-log rows carry the person;
  - flag off → a granted member sees none of Mark's rows, and Mark's unfiltered log pull sees no one else's;
  - flag on → family read/write; never for an ungranted user;
  - people add/see for granted users only;
  - `created_by` defaulting;
  - fill picks the adder's own person.

The arc-5a client suite stays green: gauntlet `arc5a-slices-2-4` 20261003-134638 is GREEN on the same tree. db/006 touches no client file.

Spec: `docs/spec.md` §5.3 RLS + §5.4 People. The arc 5b slices are drafted in HANDOFF.md at close.
