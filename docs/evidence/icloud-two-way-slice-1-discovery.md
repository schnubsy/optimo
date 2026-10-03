# arc 4 · slice 1 — iCloud discovery fix + regression (2026-10-03)

**Cause (verified):** `CalDav.calendars()` kept a collection only if its component set matched `/name="VEVENT"/`.
iCloud writes `<comp name='VEVENT'/>` (single quotes), so every calendar was dropped → `calendars = []`, 0 events.

**Fix:** `supabase/functions/_shared/caldav.ts` — `attrs()` reads attributes single- or double-quoted;
`componentNames()` drives the VEVENT check; `has()` matches empty elements exactly (`calendar` no longer matches
`calendar-…`). PROPFIND also asks `current-user-privilege-set`; each calendar now carries `shared` (calendarserver
`shared` / `shared-owner` resourcetype) and `writable` (`write` / `write-content` / `all`).

**Fixture (RULE):** `tests/fake/caldav.ts` now answers exactly like iCloud: `xmlns='DAV:'` default namespace,
per-element `xmlns='urn:ietf:params:xml:ns:caldav'`, mixed `C:` / `ICAL:` prefixes, single-quoted attributes,
`symbolic-color`, 404 propstats, the home on a partition host. Home listing: own Home (VEVENT), own "optimo", shared
read-only "Family" (VEVENT+VTODO, `cs:shared`), VTODO-only Reminders, schedule inbox / outbox, notification.

**Shared calendars:** iCloud lists accepted shared calendars as collections in the sharee's calendar-home-set (with a
`cs:shared` resourcetype), so home-set discovery covers them — *inferred from the CalDAV/calendarserver protocol, not
verified against Mark's live account*; Cowork's postcondition "Found N≥1 calendars" checks it for real.

## The new tests fail on the old code (verified)
Run of `tests/unit/caldav.test.ts` with the iCloud-shaped fixture against the OLD `caldav.ts`:
```
 ✓ tests/unit/caldav.test.ts > AES-GCM secret > round-trips and never stores the plaintext 2ms
 ✓ tests/unit/caldav.test.ts > AES-GCM secret > rejects a short KEK and a tampered ciphertext 1ms
 ✓ tests/unit/caldav.test.ts > CalDAV XML > reads multistatus responses whatever the namespace prefix, 200 propstats only 0ms
 × tests/unit/caldav.test.ts > CalDAV XML > discovers principal → home (partition host) → VEVENT calendars only 4ms
 × tests/unit/caldav.test.ts > CalDAV XML > arc 4 regression: an iCloud-shaped home listing (single-quoted attributes) keeps every event calendar 1ms
 × tests/unit/caldav.test.ts > CalDAV XML > attribute reads accept single and double quotes alike 0ms
 ✓ tests/unit/caldav.test.ts > calendar-connect / calendar-sync handlers > connect: wrong password → 401 plain message, nothing stored, password never logged 1ms
 ✓ tests/unit/caldav.test.ts > calendar-connect / calendar-sync handlers > connect: no JWT → 401 0ms
 × tests/unit/caldav.test.ts > calendar-connect / calendar-sync handlers > connect: discovers calendars, stores only ciphertext, returns the public row 1ms
 × tests/unit/caldav.test.ts > calendar-connect / calendar-sync handlers > sync: upserts instances, is idempotent, tombstones vanished events, skips disabled calendars 1ms
 × tests/unit/caldav.test.ts > calendar-connect / calendar-sync handlers > sync via cron: needs the right x-cron-secret; records a readable last_error on auth failure 1ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 6 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  tests/unit/caldav.test.ts > CalDAV XML > discovers principal → home (partition host) → VEVENT calendars only
 FAIL  tests/unit/caldav.test.ts > CalDAV XML > arc 4 regression: an iCloud-shaped home listing (single-quoted attributes) keeps every event calendar
 FAIL  tests/unit/caldav.test.ts > CalDAV XML > attribute reads accept single and double quotes alike
 FAIL  tests/unit/caldav.test.ts > calendar-connect / calendar-sync handlers > connect: discovers calendars, stores only ciphertext, returns the public row
 FAIL  tests/unit/caldav.test.ts > calendar-connect / calendar-sync handlers > sync: upserts instances, is idempotent, tombstones vanished events, skips disabled calendars
 FAIL  tests/unit/caldav.test.ts > calendar-connect / calendar-sync handlers > sync via cron: needs the right x-cron-secret; records a readable last_error on auth failure
      Tests  6 failed | 5 passed (11)
```
## …and pass on the new code
- vitest `tests/unit/caldav.test.ts`: 11/11 (regression: Home, optimo, Family with names, colours, shared, writable).
- deno `_shared/handlers_test.ts`: new "arc 4 regression" test green; sync now upserts 12 instances (11 Home + the shared dinner).
- Playwright `tests/calendar.spec.ts`: 3 calendar toggles (Reminders/inbox/outbox/notification skipped).

## Also fixed (pre-existing, time-of-day test bug)
`tests/plan.spec.ts:58` / `tests/planning.spec.ts:35` failed after 08:00 local: the page clock is pinned to 08:00 but
the in-process plan-day handler stamped `field_ts` with the wall clock, so the server's later "draft" out-voted the
client's "accepted". `FakeSupabase.clockOffset` / `now()` now follow the pinned page clock (`tests/support/app.ts`).
First gauntlet run RED on exactly those 4 (`icloud-two-way-slice-1-gauntlet-20261003-105108.log`); rerun GREEN.

## Gauntlet
`icloud-two-way-slice-1-gauntlet-20261003-105329.log` — RESULT: GREEN (vitest · build · press · deno · secret gates ·
Playwright desktop + iPhone 15 + axe · Lighthouse desktop 100/100, mobile 98/100).
