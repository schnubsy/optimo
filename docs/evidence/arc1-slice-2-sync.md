# arc1 · slice 2 — data layer, auth, sync engine (2026-09-26)

## Gauntlet (`scripts/gauntlet.sh arc1-s2`, 20260926-193355) — GREEN
- 🟢 unit (vitest) — 15 tests (merge.test 8, repo.test 6, time.test 1)
- 🟢 build (vite)
- 🟢 playwright smoke + axe (desktop, iPhone 15) incl. tests/sync.spec.ts
- 🟢 lighthouse desktop perf=100 a11y=100 · mobile perf=99 a11y=100

## Done-criteria
- `merge.test.ts`: newer-field-wins (the SQL round-trip: title@200 vs start_at@300 → both survive), order-independence,
  tombstone newer/older, tie ⇒ incoming, per-field max ts, skip keys, missing ts = 0.
- `repo.test.ts`: create stamps every field + 1 outbox row (local `_kind` stripped); update stamps only changed fields;
  no-op writes nothing; delete = tombstone; exceptions key `series|date`, settings key `me`.
- `tests/sync.spec.ts` (hermetic, `tests/support/fakeSupabase.ts` runs the same `mergeRow` as `planner_merge()`):
  two contexts, same session, offline edits of `title` (A) and `notes` (B) → online → **both converge in 115 ms**
  (budget 5 s), server row merged, `unexpected=0` (fail-closed), zero console errors.
  Realtime path proven separately with polling disabled (B receives A's online edit via postgres_changes < 3 s).
  Signed-out ⇒ sign-in screen only; magic-link request reaches `/auth/v1/otp`.
- `tests/sync.real.spec.ts` (`@real`, against press): **SKIPPED** — no `.env.test.local` test user (Mark's optional step).
- Trace: `arc1-slice-2-sync-trace.zip` (`npx playwright show-trace`). SyncBadge states:
  `arc1-slice-2-syncbadge-{synced,offline,reconverged}.png`.
