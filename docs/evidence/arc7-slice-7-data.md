# Arc 7 slice 7 — data: plan_date, someday, estimate (2026-10-09, cloud)

Migration `db/008_inbox_first.sql` (additive; NOT applied by this slice) — PGlite proof: `arc7-slice-7-db008-scratch.md`.
Place = `taskKind` (`src/data/place.ts`): gone · series · override · `start_at` ⇒ sched · `someday` ⇒ someday ·
`plan_date` ⇒ planned · else inbox. Every write runs `settlePlace` / `settleEstimate` (updateTask + createTask), so all
existing paths (actions.schedule/unschedule/move, wizard save, plan accept, drops, restoreTask) clear what no longer
applies; a place move stamps start_at + plan_date + someday together.

## API for slices 8–9
- `repo.captureToInbox(title: string, opts?: CaptureOpts): Promise<Task>` — CaptureOpts = Partial<notes, category_id,
  priority, plan_date, someday, duration_min, subtasks>; estimated = (duration_min given); else default_duration.
- `repo.planForDay(id, date 'YYYY-MM-DD'): Promise<Task | undefined>` (throws on a bad date; unschedules)
- `repo.toSomeday(id)` · `repo.toInbox(id)`: `Promise<Task | undefined>` — undefined for series/override/missing rows
- `repo.setEstimate(id, minutes: number | null): Promise<Task | undefined>` — null ⇒ estimated=false (+ default
  duration when unscheduled); minutes < 1 throws
- `repo.taskKind` (re-export) · `place.{taskKind, settlePlace, settleEstimate, withTaskDefaults, isDayKey, PLACE_FIELDS}`
- Hooks (`src/data/hooks.ts`, `undefined` while loading): `useInbox(): Task[]` (unchanged: kind 'inbox', sort_key order)
  · `useInboxCount(): number` (unfinished inbox) · `useSomeday(): Task[]` · `usePlanned(date, today = todayKey()):
  Task[]` · `usePlannedRange(from, to, today?): Record<'YYYY-MM-DD', Task[]>` (every day keyed). Lists are priority desc
  then sort_key. Overdue roll-forward: unfinished items with plan_date < today show on TODAY only (`t.plan_date < today`
  ⇒ overdue badge); a past day keeps its finished ones. Async twins for non-React use: `inboxCount`, `somedayList`,
  `plannedFor`, `plannedRange`.
- Dexie v5: index `[_kind+plan_date]`; upgrade fills defaults (no field_ts) and re-derives `_kind`.

## Sync / export
Push sends the columns as-is; pull/import fill missing ones (`withTaskDefaults`). Pre-008 server: PGRST204/42703 ⇒
re-send without the columns (and their field_ts keys), ids to `meta.colBacklog`, one probe per push; re-queued in full
once the probe passes (`OPTIONAL_COLUMNS`, engine). Fake Supabase: `server.inboxCols` (default true).
Plan-day: reads only timed tasks (`start_at` range) client- and server-side — planned/someday never reach it; no change.

## Tests
- vitest: **493 passed / 28 files** (was 455 / 26): `inboxFirst.test.ts` 32 (taskKind ×10, transitions ×14, queries +
  hooks ×5, export/import ×2 …), `inboxSync.test.ts` 5, `dexie-upgrade.test.ts` 2 (v3→v5 1k rows; seeded v4→v5).
- Playwright desktop (cloud Chromium 1194): `inboxfirst.spec.ts` 3/3 (two-device convergence; pre-008 server degrade →
  full re-send; 5k-row v4→v5 upgrade on real IndexedDB ≈ 2.0 s), `sync` · `twoway` · `inbox` · `offline` green except
  offline "installable" (`in-incognito` installability error — cloud Chromium). Wider desktop run: env-only reds
  (5k perf budgets under load avg 16, Google Fonts tunnel in smoke, external press launcher in snagtrain #25).
