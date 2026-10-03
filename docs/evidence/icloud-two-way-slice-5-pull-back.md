# arc 4 · slice 5 — pull back: iCloud edits → optimo (2026-10-03)

The pull-back path lives in `_shared/twoway.ts` (`applyFromICloud`, landed with slice 4 because slice 4's 412 handling
shares it); this slice proves it end to end and adds the REPORT-side rules:
- During each calendar-query REPORT, objects with an `optimo-<uuid>@optimo` UID are never cached as planner_events —
  they go to the two-way pass, keyed by UID. The write calendar is always read, even with its events toggled off.
- Etag ≠ link.etag → start / length / title (and all-day) read back (`icsToFields`, ical.js, VTIMEZONE-aware); only the
  fields that differ are upserted with `field_ts = now`, `device_id = 'calendar-sync'` → planner_merge() decides.
- A linked task not in the REPORT window (moved > 60 days out, or deleted) is fetched by calendar-multiget: present →
  applied; 404 → the task is tombstoned (`deleted_at`, same LWW write) and the link dropped.
- Echo guard: after a pulled-back write, `pushed_version` = the merged version, so the change is not PUT back; the
  client receives it through the sync log (not the outbox), so the debounced trigger does not fire either.

**Tests**
- vitest `tests/unit/twoway.test.ts` (slice 5 block): move → task moves (only changed fields written, field_ts ≥ now)
  · rename → title · delete → tombstoned, link dropped · no ping-pong over 3 syncs (0 PUT, 0 writes, version stable,
  pushed_version = version) · moved beyond the window → multiget, applied not tombstoned · write calendar toggled off
  still pulls back, then optimo edits push again · iCloud move + optimo notes edit both survive (field-level LWW) ·
  iCloud's own rewrite (TZID America/Chicago + VTIMEZONE, SEQUENCE, X-APPLE props) → 15:45Z, 45 min.
- deno `_shared/twoway_test.ts`: move → rename → 3 quiet syncs → delete → tombstone, in the Edge runtime.
- Playwright `tests/twoway.spec.ts` (desktop + iPhone 15): "on the iPhone" move + rename → Sync now → the device's task
  has the new title / time (written as calendar-sync); two more syncs + the debounce window → zero new PUTs; delete
  in iCloud → the task is tombstoned on the device, link gone.

**Gauntlet:** `icloud-two-way-slice-5-gauntlet-20261003-110943.log` — RESULT: GREEN (Playwright 217 passed / 0 failed;
Lighthouse desktop 100/100, mobile 98/100).
