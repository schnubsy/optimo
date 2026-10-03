# arc 4 · slice 3 — calendar picker (2026-10-03)

**Client** (`src/calendar/CalendarSettings.tsx`, `src/calendar/api.ts`, `src/styles/app.css`):
- Every discovered calendar is one row: iCloud colour dot (data, inline), name, a "Shared" badge on shared
  calendars, and the read toggle (`role="switch"`, writes `calendars[].enabled`, then syncs — unchanged).
- "Put optimo tasks in" — a labelled select (`data-testid="calendar-write"`) with "None — don't write" plus only the
  calendars with `writable !== false` (read-only shared Family is listed but not offered). It shows the account's
  `write_calendar_href` (the server defaults it to the "optimo" calendar on discovery); a change goes through the new
  `setWriteCalendar(acc, href | null)` (`update({ write_calendar_href })` — the client's column grant), then a sync and
  a refresh. Helper line: "Timed tasks are written to this calendar; edits made there come back."
- Connect-form help now says events show on the timeline and timed tasks can be written to one calendar you choose.
- Found while testing: on iPhone (WebKit) a native `<select>` ignores `min-height` and rendered 23 px tall — the picker
  select now sets an explicit `height: 48px`.

**Tests:** Playwright `tests/calendar.spec.ts` "picker" (desktop + iPhone 15): 3 rows, one "Shared" badge (Family),
optimo's dot = #3FA66B; select defaults to optimo and offers exactly None / Home / optimo; Home toggle off → stored
`enabled=false` + a calendar-sync call; select Home → stored `write_calendar_href` + a sync; None → `null`; back to
optimo; every toggle, the select and both actions ≥ 44 px tall; axe serious/critical = 0 in light and dark.
Existing toggle / honest-status tests unchanged and green.

**Screenshots:** `icloud-two-way-slice-3-picker-{desktop,iphone-15}-{light,dark}.png` (EVIDENCE=1).

**Gauntlet:** `icloud-two-way-slice-3-gauntlet-20261003-110241.log` — RESULT: GREEN (unit, build, press launcher +
publish-checks, edge functions, secret gates, Playwright smoke + axe desktop/iPhone 15; Lighthouse desktop perf 100 /
a11y 100, mobile perf 98 / a11y 100). Run from a worktree with `PRESS_DIR=/Users/mark/Documents/code/press` (the
launcher check resolves `../press` relative to the checkout and fails closed otherwise).
