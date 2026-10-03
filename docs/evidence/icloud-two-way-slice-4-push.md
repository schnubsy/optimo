# arc 4 · slice 4 — push: optimo → iCloud (2026-10-03)

**CalDAV** (`_shared/caldav.ts`): `put` (If-Match on the etag optimo last wrote / If-None-Match `*` on create; 412 →
`CalDavConflict`), `remove` (If-Match; 404 = already gone), `multiget` (calendar-multiget; a 404 member = gone).
**VEVENT** (`_shared/vevent.ts`): `taskToIcs` — UID `optimo-<task_id>@optimo`, DTSTART/DTEND UTC (no DTEND when the
task is 0 min), all-day → `VALUE=DATE` on the user's local date (`settings.tz`), SUMMARY escaped and folded at 75 octets,
`X-OPTIMO-TASK-ID`. `icsToFields` reads start / length / title back.
**Two-way pass** (`_shared/twoway.ts`, run by `syncAccount` after the event pull when a write target is set):
scheduled, non-recurring, non-override, live tasks with `start_at ≥ now−7d` and `version > pushed_version` → PUT into
`write_calendar_href`; `planner_calendar_links` upserted (etag, pushed_version). Deleted / unscheduled / made
recurring → DELETE + link removed. Completed → kept. Aged out of the window → kept. New write target → move (DELETE
old, PUT new). 412 → the iCloud edit is applied to the task (shared with slice 5's pull-back path), never overwritten.
Objects with an `optimo-` UID are never cached as events (no double display). The write calendar is read even when
its events are toggled off.
**Ports:** `tasksForPush` / `tasksByIds` / `links` / `upsertLink` / `deleteLink` / `writeTask` (upsert with
`field_ts` + `device_id = 'calendar-sync'`, returns the merged version) / `userTz` — in `supabase.ts` (service role,
paged), `tests/fake/ports.ts` (MemPorts with per-field LWW), `tests/support/fakeSupabase.ts` (its planner_merge +
sync log).
**Client:** `src/sync/engine.ts` `afterPush` listeners; `src/calendar/autosync.ts` debounces 5 s after an outbox push
that carried task rows, then calls calendar-sync if any enabled account has a write target. `useCalendarSync` keeps
`settings.tz` current when write-back is on. Spec §3 (arc 4) + §5.1 (links) updated; recurring tasks out of scope.
**Also:** eslint ignores `.claude/` (agent worktrees there broke `eslint .` with a second tsconfig root).

**Tests**
- vitest `tests/unit/twoway.test.ts` (fake CalDAV server): create (If-None-Match `*`, link, quiet over 3 syncs) ·
  update (If-Match old etag) · completed kept / unscheduled + deleted removed · move · 412 → iCloud edit applied, no
  ping-pong · never recurring / override / old / write-off · aged-out kept · all-day DATE + escaping + 75-octet folding
  · zero-length.
- deno `_shared/twoway_test.ts`: create → update → move → delete; 412.
- Playwright `tests/twoway.spec.ts` (desktop + iPhone 15): repo task → outbox → one debounced calendar-sync → object in
  the fake iCloud "optimo" calendar; edit follows; delete removes it; never cached as an event.

**Gauntlet:** `icloud-two-way-slice-4-gauntlet-20261003-110635.log` — RESULT: GREEN (Playwright 215 passed / 0 failed;
Lighthouse desktop 100/100, mobile 98/100).
