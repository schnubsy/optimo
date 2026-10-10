# Backlog — Mark's feedback 2026-10-10 (after arc 7; seed for the next UI arc)

Captured in the arc-7 cloud session. The next kickoff turns these into an ARC.md block with the other open polish items
from HANDOFF (#51 AI-tab scroller, #70 tab-bar see-through, week at 1024, nested-lane squeeze, #47 "1:30" durations).

## F1 — Day view: a true time scale (like Week has now)
Ask: bring back a fixed, proportional timeline for the Day view so gaps are visible as space, not only as text.
Today the spine compresses gaps over 60 min to a 120 px dashed band with a sentence ("A clear run of …"), so a 4-hour gap
looks the same as a 90-minute one. Note for design: this reverses the arc-6 "compressed gaps" choice for Day (decision 5,
slice 3) — the segment map (`src/timeline/segments.ts`) is still the only minute↔pixel conversion; the likely change is
`gapCap` off (or a setting), keeping nodes ≥ min height. Decide: always proportional, or a toggle (Settings → Day).

## F2 — Week view: hour scale fills the available height
Ask: the Week hour scale should stretch to fill the free vertical space instead of a fixed 36 px/hour leaving white
space below. Px-per-hour = (pane height − headers − trays) ÷ (day_end − day_start), with a sensible minimum (scroll
below it).

## F3 — Now-line and the elapsed-progress shading, back on the Day timeline
Ask: restore the now-line across the day and the shading that fills a running appointment to show how far through it
you are (the "elapsed sweep" that existed before arc 6). Arc 6 replaced the sweep with an accent ring
(`spine.css`; snagtrain #27 assertion removed) — audit 2026-10-09 lists it as LOST.

## F4 — ← / → move by the view's unit
Ask: left/right should move by the unit the view shows — a week in Week, a month in Month — not a day.
Verified cause: the on-screen ‹ › header buttons already step by week/month (arc 7 slice 3, `src/chrome/Header.tsx`
`step()`), but the KEYBOARD ←/→ in `src/Planner.tsx` (~L350–351) always do `addDays(date, ±1)`. Fix: route the keys
through the same unit logic (share one `stepDate(view, date, n)` helper). Check the iPhone strip swipe too.
