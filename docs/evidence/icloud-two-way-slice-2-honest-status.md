# arc 4 · slice 2 — rediscover on every sync + honest status (2026-10-03)

**Server** (`supabase/functions/_shared/handlers.ts`):
- `syncAccount` re-runs discovery (principal → calendar-home-set → calendars) every sync and stores the merge
  (`mergeCalendars`): known calendars keep `enabled`, new ones arrive enabled, vanished ones are removed (their events
  tombstone because they are no longer seen). `principal_url` refreshes too.
- Write-target default: a calendar named "optimo" that is NEW in a discovery becomes `write_calendar_href` when none
  is set — so Mark's existing empty account (connected while discovery was broken) gets it on its first healed sync,
  and a later explicit "None" is never overridden. A target that vanishes or turns read-only switches write-back off.
- Counts come back per account (`calendars`, `events` = live instances after the sync); an empty discovery sets
  `last_error = "No calendars found on this Apple ID"` (on connect and on sync) and clears once a calendar appears.

**Client** (`src/calendar/CalendarSettings.tsx`): status line "Found N calendars · synced HH:MM · N events" (events =
this device's cached instances for the account, live), or "No calendars found" + the error alert. Two honesty fixes
found while capturing evidence: the time now follows the app's 12/24 h setting (was the locale's "10:56 AM" under a
24 h setting), and "Sync now" no longer toasts "Calendars synced." over an account whose sync found nothing.

**Tests:** vitest `tests/unit/caldav.test.ts` (merge keeps toggles / adds / drops; default-optimo rules incl. explicit
None, read-only and vanished target; rediscovery with counts; Mark's empty account heals; empty Apple ID → error and
recovery) · deno `handlers_test.ts` (rediscovery + NO_CALENDARS) · Playwright `tests/calendar.spec.ts` "honest status"
(desktop + iPhone 15, axe): "Found 3 calendars", `synced HH:MM · 12 events`, then the empty state + toast.

**Screenshots:** `icloud-two-way-slice-2-status-{found,empty}-{desktop,iphone-15}.png`.

**Gauntlet:** `icloud-two-way-slice-2-gauntlet-20261003-105725.log` — RESULT: GREEN (Lighthouse desktop 100/100,
mobile 98/100).
