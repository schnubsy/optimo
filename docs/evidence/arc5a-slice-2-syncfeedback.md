# arc 5a · slice 2 — sync button feedback (B5)

**Ask:** in Settings → Calendars, "Sync now" never changed when pressed. Now:
- pressed → spinner + "Syncing…", button disabled;
- success → "Synced · N events · N sent to iCloud" for 4 s, then back to "Sync now";
- failure → the reason in red, and the button reads "Retry".

Automatic syncs use the same state, so they show on the button too. That covers the after-push trigger and the interval, visibility and mount runs.

**Shipped**
- `supabase/functions/_shared/handlers.ts`: the calendar-sync response gains two top-level fields. The change is additive and `accounts[]` is unchanged.
  - `events`: the sum of each account's `events` (`seen.size`).
  - `pushed`: the sum of each account's `twoWay.pushed`.

  Response shape: `{ accounts: [...], events: number, pushed: number }`.
  **Cowork:** redeploy `calendar-sync` to get the new fields. Until then the client sums `accounts[]` itself.
- `src/calendar/syncStatus.ts`: a pure reducer plus a zustand store.
  - Flow: `idle → syncing → done{events,pushed,at}`, which returns to idle after 4000 ms; otherwise `failed{reason}`. Retry = start → syncing.
  - A start while syncing is ignored. A late clear never wipes a newer state.
  - `reasonFor()` turns failures into plain copy: NO_CALENDARS, `not_connected`, network or fetch failures, and server messages.
- `src/calendar/api.ts` `syncCalendars()` now returns `{events, pushed}`.
  - It reads the top-level fields, or sums `accounts[]` when they are missing (older server).
  - It drives the store: start, then done or failed. An account error such as no calendars resolves, but the state goes failed with that reason. HTTP and network errors throw and also set failed.
  - A call made while a sync is running queues one follow-up run instead of being dropped, because its settings or tasks may be newer. The status stays "syncing" until the last run settles.
- `src/calendar/autosync.ts`: errors are no longer swallowed silently. The state goes failed with the reason; nothing is rethrown, so there is no unhandled rejection.
- `src/calendar/SyncButton.tsx` + `syncbutton.css`: the button renders from the store.
  - States: "Sync now" / spinner + "Syncing…" (`disabled`, `aria-busy`) / "Synced · …" / "Retry".
  - The status line is `role=status aria-live=polite`. A failure shows its reason in red (`--danger-ink`).
  - The spinner is CSS-only and animates a transform; it stays still under reduced motion.
- `CalendarSettings.tsx`: the change is limited to `sync()` and the button, which is now `<SyncButton onSync={sync}/>`. The "Calendars synced." success toast is gone.
- `tests/calendar.spec.ts`: the empty-Apple-ID check now reads the red reason on the button instead of a toast (one line).

**Tests**
- `tests/unit/syncStatus.test.ts` (22 cases): every reducer transition, the 4 s auto-clear with fake timers, the reason copy, singular/plural, and old-server totals.
- `tests/unit/syncCalendars.test.ts` (3 cases): the store driven from a mocked function call, follow-up coalescing, and account versus HTTP errors.
- `supabase/functions/_shared/twoway_test.ts`: top-level `events` equals the sum over accounts, `pushed` is 2 for two new tasks, and 0 on a resync.
- `tests/syncfeedback.spec.ts` (desktop + iPhone 15, hermetic fake running the real handler):
  - pressed: the call is held at the network, so we see "Syncing…", disabled, aria-busy and the spinner. Then "Synced · N events · 0 sent to iCloud", with N from the response, then "Sync now" again.
  - failure: a 500 shows the red reason and Retry; Retry runs the real handler and succeeds.
  - automatic: a created task pushes, the after-push sync shows "Syncing…", then "Synced · … · 1 sent to iCloud".
  - axe is clean (serious/critical) in the syncing, done and failed states.

**Gauntlet** `arc5a-slice-2` 20261003-133912: **GREEN**.
- Unit tests: 390 passed. Deno: 18 passed.
- Playwright: 223 passed, 113 skipped.
- Lighthouse: desktop perf 100 / a11y 100, mobile perf 98 / a11y 100.

The first run, 133550, was RED on `calendar.spec` picker (iPhone). A write-target change made mid-sync had joined the running sync and never got its own run. Queuing a follow-up run fixed it, and the re-run was green.

**Screenshots** (`EVIDENCE=1`):
- `arc5a-slice-2-syncing-desktop.png`, `arc5a-slice-2-syncing-iphone-15.png`
- `arc5a-slice-2-done-desktop.png`, `arc5a-slice-2-done-iphone-15.png`
- `arc5a-slice-2-failed-desktop.png`, `arc5a-slice-2-failed-iphone-15.png`
