# Arc 2 · slice 4 — iCloud calendar (CalDAV, read-only)

- **Functions** (`supabase/functions/`, committed, **not deployed** — Mark/Cowork, HANDOFF): `calendar-connect`
  (JWT) and `calendar-sync` (JWT or `x-cron-secret`), thin `Deno.serve` wrappers over runtime-agnostic handlers in
  `_shared/handlers.ts` with ports; `_shared/{crypto,caldav,ics,supabase}.ts`; `deno.json` import map;
  `supabase/config.toml` (calendar-sync `verify_jwt = false`, the handler checks JWT or cron secret itself).
- **Secret handling:** the app-specific password is posted once, AES-GCM-encrypted with `PLANNER_KEK`
  (12-byte IV, base64(iv|ct)), only ciphertext stored; never logged; the client reads the secret-free view and
  clears the field after connect. `scripts/secrets.mjs` → gitignored `.secrets/planner.env` (PLANNER_KEK,
  CRON_SECRET), never overwriting, printing the guarded `supabase secrets set` for HANDOFF.
- **Sync:** REPORT calendar-query [now−7d, now+60d] on enabled calendars; ical.js expands RRULE/EXDATE/overrides;
  instance uid `UID#start` satisfies `unique (account_id, calendar_href, uid)` from db/002; change detection on
  etag|start|end|title; vanished → tombstoned; clients pull `planner_events` through the sync log (server-owned:
  replace). App refresh on open + every 15 min while visible; disconnect drops local events (cascade has no log);
  other devices prune events of vanished accounts.
- **UI:** Settings → Calendars (connect form + help link to appleid.apple.com, per-calendar switches, Sync now,
  Disconnect, last sync / last_error); outlined event pills with a calendar chip, fixed, tap → details; share overlap
  columns with tasks; free gaps and the header's free time account for events; all-day events in the all-day strip.

## Tests
- `deno check` + `deno test` (real Edge runtime) and vitest `ics.test.ts` (5) + `caldav.test.ts` (9): AES-GCM
  round trip / tamper / short key; multistatus parsing across prefixes; discovery to the partition host; VEVENT-only
  calendars; RRULE (COUNT=10) − EXDATE + moved instance; all-day; window clipping; cancelled; connect 401 / no JWT /
  ciphertext only; sync idempotent + tombstones + disabled calendars; cron secret + readable last_error.
  Log: `arc2-slice-4-functions.txt`.
- `tests/calendar.spec.ts` (desktop + iPhone) against the hermetic CalDAV server + fake PostgREST, running the
  **real handlers in-process**: connect → calendars listed → today's events on the timeline → details → toggle off
  (tombstones pulled) → on → disconnect removes them; wrong password → plain message, nothing stored; events share
  columns with tasks and change the free total. **Password gate:** the fixture password appears nowhere in
  IndexedDB, localStorage, console or any server row; the gauntlet greps `docs/evidence` + `dist` for it.
- Gauntlet `arc2-s4-gauntlet-20260927-153257` GREEN (now incl. deno check/test + secret gate).

## Evidence
`arc2-slice-4-{settings,timeline}-{desktop,iphone-15}.png`, `arc2-slice-4-functions.txt`.
