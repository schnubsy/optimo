# Arc 2 · slice 1 — snags #1–#12 + resize-by-edge persistence

## Resize bug (🔴) — root cause and fix
- **Repro first** (`tests/timeline.spec.ts` › "resize: a fast flick (move + release in one frame) still commits"):
  pointerdown → pointermove(+½ h) → pointerup dispatched synchronously on the handle. Before the fix:
  `Expected: 120 · Received: 90` on desktop and iPhone 15 — the block grew on screen but the stored
  `duration_min` did not change.
- **Cause:** `Block.tsx` `onResizeUp` read the live duration from React render state. A release that arrives before
  React renders the last move (a quick thumb flick on iPhone) saw the pre-move closure, so `resizeItem()` got the
  old value and returned early (`duration === current`).
- **Fix:** the live value lives in a ref; the commit recomputes the duration from the release point
  (`resizeTo()` in `src/timeline/layout.ts`: snap per setting, min 5 min), on pointer-up only, through
  `resizeItem → patchItem → repo.updateTask` (field_ts stamped, outbox → server). Handle = 44 px band centred on
  the bottom edge (≤30 % of a short block's own height). Keyboard: Shift+↑/↓ = ±5 min, min 5. An open editor
  picks up a duration changed outside it (unless edited in the sheet).
- **Proof:** "resize persists" asserts the fake server row carries `duration_min: 120` and the block reads
  `data-duration="120"` after a reload. Screenshots: `arc2-slice-1-resize-before-*.png` (90 min, selected) →
  `arc2-slice-1-resize-after-reload-*.png` (14:00–16:00 after reload), desktop + iPhone 15.

## Snags (tests/snags.spec.ts, one case each)
| # | Fix | Test asserts |
|---|---|---|
| 1 | `late` on blocks that ended undone today; " late" text + edge; accessible name ", late" | data-late, name, ::after content |
| 2 | inner priority rule removed; P-label in name and on tiny blocks | box-shadow none, name /P1/ |
| 3 | inbox short codes (Pers, Err, Work, Learn, Meet, Fam, Hlth, Home) | "Pers", no overflow |
| 4 | week header "8h15 plan · 8h00 free"; dashed free rows ≥ 30 min in columns | text, week-free count |
| 5 | Synced dot = ink-3, pending = ink (signal reserved) | computed colour ≠ signal |
| 6 | mobile strip one row (no Unplaced, sync = dot + sr text); parse row floats, hint only on focus | one row, hint hidden/visible |
| 7 | free rows mask hour lines | non-transparent background |
| 8 | square slab checkboxes (appearance none) in editor + focus | appearance none |
| 9 | focus hero = time left, sub = elapsed of total; ✓ baseline | 90:00 countdown, "of 90 min" |
| 10 | mobile pane single row (no band); place header "0:30, P1" | inbox top = pane top, header text |
| 11 | month ‹ › grouped after the title | geometry |
| 12 | day bounds = 15-min selects in the user's clock | 06:00 → 6:00 AM, 7:30 AM persists 450 |

Unit: `resizeTo` (snap, min 5), `isLate` (layout.test.ts). Gauntlet: `arc2-s1-gauntlet-20260927-144630.log` —
GREEN (vitest 88 · Playwright + axe desktop/iPhone 15 · Lighthouse desktop 100/100, mobile 98/100).
