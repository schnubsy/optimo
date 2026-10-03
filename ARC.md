## 2026-10-03 — arc 4: iCloud two-way sync + calendar picker

Why: Mark connected iCloud twice; both times `calendars` = [] and 0 events, while "synced HH:MM" showed. Verified cause
(Cowork repro, node against `_shared/caldav.ts`): `calendars()` keeps a collection only if its component set matches
`/name="VEVENT"/` — iCloud writes `name='VEVENT'` (single quotes), so every calendar is dropped. Same reply with double
quotes → the calendar is kept. Mark's Apple ID sees a personal "optimo" calendar + shared family calendars.

Ratified by Mark (2026-10-03):
- **Two-way.** Timed optimo tasks are written into ONE chosen iCloud calendar; edits made in iCloud (move/rename/
  delete) flow BACK to the optimo task. All timed tasks sync (inbox items without a time do not). Completed tasks stay
  in the calendar.
- **Picker.** Settings → Calendars lists every discovered calendar (own + shared), with a read on/off toggle each and
  one "Put optimo tasks in" choice (any writable calendar; default the calendar named "optimo" if present, else none).
- **Honest status.** "Found N calendars", "synced HH:MM · N events", and a clear "No calendars found" / error state.

RULE: `db/005_calendar_twoway.sql` (INBOX FILE) is ALREADY APPLIED by Cowork — commit it unchanged; never apply it.
RULE: Edge Function deploys (calendar-connect, calendar-sync) are Cowork's, after the merge — close-out manifest
      item "deploy (Edge)" = BLOCKED → HANDOFF step for Cowork. Code never prints or logs the app password.
RULE: Sync contract unchanged: server writes to planner_tasks go through upsert with `field_ts` + device_id
      `calendar-sync`, so planner_merge decides field-level last-writer-wins like any client.
RULE: Every CalDAV fixture in tests is shaped like a real iCloud reply (single-quoted attributes, `xmlns='DAV:'`,
      mixed prefixes, partition host) — a double-quote-only fixture is what hid this bug.

### Slice 1 — discovery fix + regression
Scope: `_shared/caldav.ts` attribute matching accepts `'` and `"` (VEVENT check, any other attribute reads); test with an
iCloud-shaped multistatus (own calendar, shared calendar, VTODO-only Reminders list, inbox/outbox/notification
collections) → exactly the event calendars, names and colours right. Also confirm shared calendars appear in the
home-set listing; if iCloud lists them elsewhere, discover there too.
Done: the new test fails on the old code and passes on the new; existing deno tests green.
Status:

### Slice 2 — rediscover on every sync + honest status
Scope: `syncAccount` re-runs discovery each time and merges into `calendars` (keep each calendar's `enabled`; new
ones arrive enabled; vanished ones removed); stores counts; `last_error` = "No calendars found on this Apple ID" when
the list is empty. Settings shows "Found N calendars" + "synced HH:MM · N events".
Done: deno tests for merge + empty-list error; Playwright shows both states.
Status:

### Slice 3 — calendar picker
Scope: `src/calendar/CalendarSettings.tsx`: list every calendar (colour dot, name, shared badge) with a read toggle
(updates `calendars[].enabled`) and a "Put optimo tasks in" select writing `write_calendar_href` (column added by 005).
Default selection = the calendar named "optimo" when present. Toggle changes trigger a sync.
Done: Playwright desktop + iPhone 15 (axe) cover toggle + write-target select; 44px targets.
Status:

### Slice 4 — push: optimo → iCloud
Scope: CalDAV `put`/`delete` in `caldav.ts` (If-Match etag; If-None-Match * on create). In `calendar-sync`, after the
pull: every non-recurring, non-deleted task with `start_at` whose `version` > link.pushed_version → PUT a VEVENT
(UID `optimo-<task_id>@optimo`, DTSTART/DTEND from start_at+duration_min, SUMMARY title, X-OPTIMO-TASK-ID) into
`write_calendar_href`; upsert `planner_calendar_links`. Task deleted or unscheduled → DELETE the object + link.
Completed tasks keep their event. Write-target changed → move (DELETE old, PUT new). 412 on PUT → treat as an
iCloud-side edit (slice 5) instead of overwriting. Client calls calendar-sync (debounced ~5 s) after its outbox flush
so changes land quickly; cron stays the backstop. Recurring tasks: out of scope this arc (note in spec).
Done: deno tests with a fake CalDAV server (create, update, delete, move, 412); Playwright fake end-to-end.
Status:

### Slice 5 — pull back: iCloud edits → optimo
Scope: during the pull, objects whose UID starts `optimo-` are NOT cached as planner_events (no double display); if
their etag differs from the link's, apply start/end/title back to the task (upsert with field_ts now, device_id
`calendar-sync`) and update the link; object gone from iCloud → tombstone the task. Echo guard: a task change made by
the pull must not be re-pushed (set pushed_version to the merged version).
Done: deno tests: move in iCloud → task moves; rename → title; delete → task tombstoned; no ping-pong over 3 syncs.
Status:

### Slice 6 — design review (Eye LITE) · Slice 7 — Lighthouse budget
Standard UI-arc slices (arc.md). Only 🔴 P0 actioned in-arc; the rest filed as `snag`.
Status:
