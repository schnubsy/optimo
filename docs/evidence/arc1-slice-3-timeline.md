# arc1 · slice 3 — day timeline, drag/resize, task editor (2026-09-26)

## Gauntlet (`scripts/gauntlet.sh arc1-s3`, 20260926-194824) — GREEN
- 🟢 unit (vitest) — 29 tests (+ layout.test: overlap columns, snap 5/10/15, bounds, free rows, Place first-fit, push-down, day stats, virtual window)
- 🟢 build (vite)
- 🟢 playwright smoke + axe (desktop, iPhone 15) incl. tests/timeline.spec.ts
- 🟢 lighthouse desktop perf=100 a11y=100 · mobile perf=99 a11y=100 (sign-in route; Lighthouse cannot authenticate)

## timeline.spec.ts — desktop + iPhone 15
- renders 10 blocks, free rows, now line; overlapping 16:00/16:15 blocks sit side by side; strip `Done 1/10`
- tap empty slot (17:00, inside a free row) → sheet prefilled 17:00 → saved block at 1020 min
- drag Lunch down 2 h → `start_at` +120 min exactly, duration unchanged, "Moved" undo toast
- select → resize band → +30 min → duration 90 → 120, start unchanged
- complete toggles (strip 2/10) and Undo restores
- keyboard (desktop): select, ↓ nudges +5 min, Enter opens editor, Esc closes
- axe: zero serious/critical with a populated day AND with the editor open (fixed: free-row / running-time contrast in light theme, sheet fade)
- zero console errors in every test (trackErrors)

## Screenshots
`arc1-slice-3-timeline-{desktop,iphone-15}-{dark,light}.png` (selected block shows the resize band).
