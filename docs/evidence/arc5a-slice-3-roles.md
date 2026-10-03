# arc 5a · slice 3 — One clear role per calendar (B4)

**Shipped**
- Each calendar row in Settings → Calendars now shows a colour dot, the name, the "Shared" badge, a segmented control **Off · Show in optimo · Two-way**, and one helper line for the current role:
  - Off — "Hidden in optimo."
  - Show in optimo — "Its events appear in optimo. optimo never changes it."
  - Two-way — "optimo tasks are written here, and edits made here come back."
- Removed: the per-calendar read switches and the separate "Put optimo tasks in" select (`WriteTarget`).
- `src/calendar/roles.ts` (pure):
  - `roleOf(cal, writeHref)` and `applyRole(calendars, writeHref, href, role)` map roles onto the existing data. No DDL.
    - Off ⇔ `enabled=false`, and the write target is cleared if this was it.
    - Show ⇔ `enabled=true` and not the write target.
    - Two-way ⇔ `write_calendar_href` is this calendar, with `enabled=true`.
  - Only one calendar can be Two-way. Picking Two-way on another row demotes the old one to Show, and turns it on if it was stored with `enabled=false`.
  - Two-way on a read-only calendar throws.
  - A write target always reads as Two-way, because the server reads it whatever its `enabled` value.
- `src/calendar/api.ts`: the new `setCalendarRole` stores `calendars` and `write_calendar_href` in **one** `.update`, so a role change is never half-applied. It replaces `setCalendarEnabled` and `setWriteCalendar`.
- `src/calendar/CalendarRoles.tsx` + `roles.css`:
  - Each row is an accessible `radiogroup` of `radio` buttons, named by the calendar.
  - Keyboard: roving tabindex, and the arrow keys skip disabled options.
  - Each option is at least 44 px tall.
  - The update is optimistic, then stored in one update, then followed by the existing `syncCalendars().catch(() => {})`. If storing fails, the change is rolled back and a toast explains why.
  - A read-only calendar's Two-way option is disabled. Its reason, "This calendar is read-only on iCloud.", is given as `title` and `aria-describedby`.

**#56 — target-change side effects:** a role change that changes the Two-way calendar now shows a toast:
- moved: "optimo tasks now go to “{name}” — the ones already written moved there."
- first: "optimo tasks now go to “{name}”."
- stopped: "optimo stopped writing to iCloud. Events already there were left as they are."

When no calendar is Two-way, a note appears under the list: "optimo isn't writing to any calendar. Pick Two-way on one to send your tasks there."

**#58 — empty state:** when discovery finds 0 calendars and the only error is the server's NO_CALENDARS, `AccountStatus` shows ONE message: "No calendars on this Apple ID. Check that Calendars is turned on in iCloud settings on your iPhone or Mac, then sync again."
- There is no "synced · 0 events" line and no red alert.
- `sync()` has one commented change: it skips its toast for this case only. The Sync button and its other feedback are untouched (slice 2 owns them).

**Tests**
- `tests/unit/roles.test.ts`: 11 cases.
  - Mapping in both directions, including a disabled write target.
  - Demotion, including a disabled old target becoming Show.
  - Off and Show on the Two-way row.
  - The read-only guard.
  - Idempotence and no input mutation.
  - The #56 copy.
- `tests/calroles.spec.ts` (desktop + iPhone 15):
  - Mapping: Off, Show and Two-way end up stored correctly in the fake's row.
  - Single Two-way: B becomes Two-way, A shows Show, the write target is B, and the "moved" toast appears.
  - The "stopped" toast and the no-Two-way note appear, and a sync does not re-pick the target.
  - The "first" toast.
  - Arrow keys work.
  - Every option is at least 44 px, and axe is clean in light and dark.
  - The read-only Family calendar: Two-way is disabled and has the description, and the arrow keys skip it.
  - Empty Apple ID: exactly one "No calendars" text, no alert, no "0 events", no toast. It recovers when calendars appear.
- `tests/calendar.spec.ts`: moved off the old switch and select, with the same intent.
  - Turning Home and Family Off removes their events, and Show brings them back.
  - Picker test: colour dot, Shared badge, server-picked "optimo" starts Two-way, 44 px targets, axe in both themes.
  - The empty-Apple-ID assertions moved to calroles.spec.
- `tests/twoway.spec.ts`: unchanged, still green.

**Gauntlet** `arc5a-slice-3` 20261003-133609: **GREEN**. It ran first time.
- unit: 376 passed
- Edge functions: deno check + test
- secret gates
- Playwright: 223 passed
- Lighthouse desktop: perf 100, a11y 100
- Lighthouse mobile: perf 95, a11y 100

Screenshots (EVIDENCE=1): `arc5a-slice-3-roles-desktop.png`, `arc5a-slice-3-roles-iphone-15.png` (Home Two-way, optimo
demoted to Show, Family read-only with Two-way disabled), `arc5a-slice-3-empty-desktop.png`, `arc5a-slice-3-empty-iphone-15.png`.
