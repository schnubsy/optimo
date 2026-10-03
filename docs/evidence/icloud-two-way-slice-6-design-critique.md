# Arc 4 — iCloud two-way · Settings → Calendars · Eye LITE design critique

**Date:** 2026-10-03
**Scope:** Settings → Calendars after arc 4: status line (found / empty + error), per-calendar list (colour dot, name,
"Shared" badge, read switch), "Put optimo tasks in" select + helper. Code: `src/calendar/CalendarSettings.tsx`,
`.cal-*` in `src/styles/app.css`, `.switch*` in `src/editor/sheet.css`; behaviour checked against
`supabase/functions/_shared/{handlers,twoway}.ts`.
**Evidence:** `icloud-two-way-slice-2-status-{found,empty}-{desktop,iphone-15}.png` (before the picker),
`icloud-two-way-slice-3-picker-{desktop,iphone-15}-{light,dark}.png` (final).
**Lenses:** Flow review (flows, IA, states, error paths, a11y) · two-way clarity · hierarchy · contrast light/dark ·
44px targets · Settings consistency · honest states · originality gate.

Checked and passing: every row, switch row, select and button is ≥ 44px (switch rows 48px, select 48px, ghost
buttons ~44px); text contrast is within the Meadow token ratios in both themes (ink-2 ≈ 5.6:1, danger-ink on panel
passes); the write calendar keeps being read even with its switch off (`handlers.ts:167`), so turning it off cannot
break pull-back; optimo-owned objects are never cached as events, so there is no duplicate on the timeline; card,
heading and button styling match the Clock / Reminders / Planning cards; originality gate is clean (no other
planner's copy or icons; "Shared" and the colour dots come from the user's own iCloud data).

## Findings

| ID | Sev | Screenshot | Problem | Fix |
|---|---|---|---|---|
| ARC4-P1-1 | 🟡 P1 | slice-3-picker-* (all four) | The helper understates what two-way means. "Edits made there come back" doesn't say that **deleting the event in iCloud deletes the task in optimo** (slice 5 tombstones it), and "Timed tasks" is wrong: any scheduled, non-repeating task is written, all-day ones included (`twoway.ts:70`), and repeating tasks are not. This is the only explanation of a coupling that can destroy data. | Replace the helper copy with: `Scheduled tasks (not repeating ones) appear in this calendar. Moving, renaming or deleting one there changes it here — deleting it there deletes the task.` |
| ARC4-P1-2 | 🟡 P1 | slice-3-picker-* | Changing the select has hidden side effects. Picking another calendar **moves every linked event** (DELETE + PUT, `twoway.ts:146`). Picking None leaves the events optimo already wrote in iCloud, and they stop updating (`twoway.ts:74`). Neither is stated, and nothing confirms the change afterwards. | Rename the None option to `None — stop writing (events already there stay)`. After a successful change, notify `optimo tasks now go to “{name}” — existing ones moved.` (or `Stopped writing to iCloud. Events already there were left as they are.`). Let the helper reflect the None state: `optimo isn't writing to any calendar.` |
| ARC4-P1-3 | 🟡 P1 | slice-3-picker-* · slice-2-status-found-* | The section has two different controls (read: which calendars show on the timeline; write: where tasks go), but nothing labels them. The switches have no visible meaning, and their accessible name is just "Home" / "Family Shared", so VoiceOver reads "Home, switch, on" with no verb (WCAG 1.3.1 / 2.4.6). The select sits only `--sp-1` below the list, so it reads as part of it. | Add a sub-label above the list, `<p className="cal-sub" id={`cal-read-${a.id}`}>Show on timeline</p>`, and set `aria-describedby={`cal-read-${a.id}`}` on each switch (or `aria-label={`Show ${c.name} on timeline`}`). Give write its own group: `.cal-write { padding-top: var(--sp-3); margin-top: var(--sp-1); border-top: 1px solid var(--line); }` plus `.cal-sub { margin: var(--sp-1) 0 0; font-size: var(--fs-13); font-weight: var(--fw-semibold); color: var(--ink-2); }`. |
| ARC4-P1-4 | 🟡 P1 | slice-2-status-empty-desktop · …-empty-iphone-15 | The empty state shows the same fact three times: status "No calendars found", the red line "No calendars found on this Apple ID", and a toast with the same text. It also gives no next step, and "synced 10:57 · 0 events" next to a failure reads as success. | Status line in the empty state: `No calendars found` (drop "synced · 0 events" when `found === 0`). Make the error line actionable: `No calendars on this Apple ID. Check that Calendars is on in iCloud settings on your iPhone or Mac, then Sync now.` Don't toast when the inline `role="alert"` is already visible (in `sync()`, skip `notify` if `failed`). |
| ARC4-P1-5 | 🟡 P1 | slice-3-picker-* · slice-2-status-* | "synced HH:MM" has no day. A sync from yesterday 11:03 reads like a sync from today, which undercuts the "honest status" goal. | Prefix with a relative day when the sync wasn't today: `synced yesterday 11:03` / `synced Thu 11:03`, and use `synced just now` under 1 min. Use the same `fmtClock` for the time part. |
| ARC4-P1-6 | 🟡 P1 | slice-3-picker-* · slice-2-status-* | Disconnect is destructive but looks exactly like Sync now (same ghost pill, side by side) and acts on one tap with no confirmation. The user isn't told what happens to the events optimo wrote to iCloud. | Confirm first: `Disconnect iCloud? Its events leave your timeline. Events optimo wrote to “{write calendar}” stay in iCloud.` (adjust to the real server behaviour). Style it as danger: `.cal-disconnect { color: var(--danger-ink); }` and add `margin-left: auto` so it sits apart from Sync now. |
| ARC4-P2-1 | ⚪ P2 | slice-3-picker-* | The list doesn't show which calendar is the write target, so the two-way link is only visible in the select below it. | On the matching row, add a second badge after the name: `<span className="cal-badge cal-badge--write">Tasks go here</span>`, with `.cal-badge--write { background: var(--accent-tint); color: var(--accent-ink); box-shadow: none; }`. |
| ARC4-P2-2 | ⚪ P2 | slice-3-picker-* | "Shared" doesn't say whether optimo can write there. Read-only shared calendars are silently left out of the select, which can look like a bug. | When `c.writable === false`, render the badge as `Shared · read-only` and add one line under the select: `Read-only calendars can't hold optimo tasks.` |
| ARC4-P2-3 | ⚪ P2 | slice-3-picker-desktop-dark · …-iphone-15-dark | In dark mode, an "on" switch has a dark knob (`--surface`, L 0.27) on a mid-red track. It reads as a hole rather than a thumb, and the red doesn't match the dark accent used by the Clock chip, the today marker and the FAB. | `[data-theme="dark"] .switch::after { background: var(--n-900); }` and make sure the on-track uses the dark `--accent` (check that `tokens-a11y.css` isn't pinning the light value). |
| ARC4-P2-4 | ⚪ P2 | slice-3-picker-* | Flipping a switch waits for a server round-trip and then a full sync, with no pending state. Repeated taps queue requests, and the switch only moves once the save finishes. | Flip the switch optimistically, then set `aria-busy="true"` and `.cal-row[aria-busy='true'] .switch { opacity: .6; }` until the save finishes. Revert and notify `Couldn't change {name} — try again.` on error. |
| ARC4-P2-5 | ⚪ P2 | slice-3-picker-* | Picking a write target creates nothing to confirm it worked. Once the change saves, the status line still says only "N events" read. | Add the write count to the status line once two-way is on: `Found 3 calendars · synced 11:03 · 12 events · 5 tasks in “optimo”` (the count can come from the sync result `pushed`/links, or be left out until it's available). |

**Verdict:** No P0. The states are honest and the controls are sound and accessible enough to ship. Fix ARC4-P1-1 and
ARC4-P1-2 (the copy for iCloud deletes and for changing the target) before Mark relies on two-way with real data.

## Disposition (Code, 2026-10-03)
- No 🔴 P0 — nothing was required in-arc.
- **ARC4-P1-1 fixed in-arc** (deliberate exception to "P0 only"): the helper was factually wrong about what is written
  and silent that an iCloud delete deletes the task. It is a one-line copy correction, and Mark will rely on two-way
  as soon as Cowork deploys after the merge. The new copy, now in `CalendarSettings.tsx` and asserted in
  `tests/calendar.spec.ts`: "Scheduled tasks (not repeating ones) appear in this calendar. Moving, renaming or deleting one
  there changes it here — deleting it there deletes the task."
- Filed as `snag`: ARC4-P1-2 → #56 · P1-3 → #57 · P1-4 → #58 · P1-5 → #59 · P1-6 → #60 · P2-1 → #61 · P2-2 → #62 ·
  P2-3 → #63 · P2-4 → #64 · P2-5 → #65. #56 (target-change side effects) and #58 (empty state) go first.

**Gauntlet after the P1-1 copy fix:** `icloud-two-way-slice-6-gauntlet-20261003-111423.log` — RESULT: GREEN.
