# arc 5a · slices 2–4 merged onto `arc/family-wing-people`

The slices were built in parallel sub-agent worktrees off `f9edd6d`. Each was gauntlet-GREEN on its own (see each slice's md), then cherry-picked in order:

| slice | worktree commit | on the arc branch |
|---|---|---|
| 2 — sync button feedback | 00c5950 | fbe6526 |
| 3 — one role per calendar (#56, #58) | 7cf8a02 | ff78c31 |
| 4 — paint a block | c79250d | 8545bfa |

**Conflict resolution (slice 3 onto 2)** in `src/calendar/CalendarSettings.tsx` and `tests/calendar.spec.ts`:
- `sync()` keeps slice 2's version: no success toast; the feedback lives on `SyncButton`.
- The rows come from slice 3 (`CalendarRoles`).
- calendar.spec's empty-Apple-ID block moved to calroles.spec, as slice 3 intended.

**Cross-slice fix (#58, "said once").** On an Apple ID with no calendars, slice 2's button repeated "No calendars found on this Apple ID." in red. That sat beside slice 3's empty-state message. Now:
- `SyncButton` stays quiet for that one reason (`NO_CALENDARS_REASON` in `syncStatus.ts`): no red line, and the label reads "Sync again".
- Every other failure keeps the red reason and Retry.
- `calroles.spec` asserts that `calendar-sync-error` is absent and that the button reads "Sync again".

**Gauntlet** `arc5a-slices-2-4` 20261003-134638: **GREEN**
- unit, build, launcher + publish-checks, deno, secret gates, Playwright smoke + axe (desktop + iPhone 15): all green.
- Lighthouse: desktop 100/100, mobile 98/100.

**Note.** Run uncapped (default workers on a shared machine), the timing-sensitive calendar specs failed. Capped at 3 workers (`PW_WORKERS=3`), the same 26 passed. The gauntlet runs with a cap.
