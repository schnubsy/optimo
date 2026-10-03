# arc 5a · slice 4 — Paint a block by dragging (B3)

**Shipped**
- `src/timeline/paint.ts` holds the pure span maths, `paintSpan(anchor, cur, snap)`:
  - Both ends snap to `settings.snap` (5/10/15).
  - Dragging upward paints above the press point; the span is `min..max`.
  - The minimum length is `max(snap, MIN_DURATION)`, grown in the drag direction.
  - The span is clamped to the day (0–24:00).
- `src/timeline/usePaint.ts` is the gesture. It uses native pointer listeners on `.tl-inner`, and keeps its state in refs and closures, not React state.
  - It starts only when the press lands on empty space: the bare timeline or a free-gap body. It ignores blocks, events, clusters, buttons, the free-gap label and "+", the resize handle and the category picker.
  - **Mouse:** painting starts after ≥ 4 px of vertical travel. Less than that is a plain click, so click-to-create and the free-gap click are unchanged. A capture-phase click guard swallows the one click that follows a paint release.
  - **Touch/pen:** a 400 ms hold, the same as the task-drag `TouchSensor`. Moving > 10 px before it fires cancels, so the browser scroll wins. Nothing calls `preventDefault` before activation.
    - On activation the gesture captures the pointer and registers a `touchmove {passive:false}` preventDefault, only for the rest of the gesture.
    - It also suppresses `contextmenu` and gives a small scale-in cue on the ghost. There is no haptic.
  - **Auto-scroll:** within 36 px of the scroller's top or bottom edge, so a block can be painted past the viewport.
  - Esc cancels a mouse paint.
  - **Commit:** recomputed from the release point (lessons 2026-09-27 [dnd]).
- **Ghost** (`PaintGhost` in `src/timeline/PaintLayer.tsx`): always mounted and hidden (`visibility`).
  - Each rAF frame writes only transforms: the wrapper `translate3d(0, start)`, a one-hour fill `scaleY(len/60)`, and an end cap `translate3d(0, len)`.
  - The label's existing text node gets a new `nodeValue`. No React render and no `top`/`height` writes per frame.
  - **Style:** original. An accent-tint fill with a solid accent edge on the left, dashed accent caps top and bottom, and a surface pill with the live range ("17:00–17:45" via `fmtClock`, so it follows the 12/24 h setting).
  - The cue animation is off under `prefers-reduced-motion`.
- **Release** → `paintBlock(day, start, len)` (`src/actions.ts`):
  - `repo.createTask({ title: '', start_at, duration_min, sort_key, reminders: default lead })` and selects it. The sheet does not open.
  - A toast reads "Untitled block added" with a 5 s Undo (soft delete).
  - One click or tap on the selected block, or Enter, opens TaskSheet through the existing edit path.
  - An untitled block renders "Untitled" in italic. The accessible name is "Untitled, 17:00–17:45".
- **Keyboard** (`PaintSlot`): a focusable slot cursor (`role=button`), the first tab stop in the timeline. It is invisible until focus-visible.
  - On focus it lands on now (today) or the visible top (other days).
  - ↑/↓ move it by the snap step. A polite live region announces "Empty slot 12:15" or "12:15, taken by …".
  - Enter (or Space) starts a block, ↑/↓ move its end, Enter creates through the same `paintBlock`, and Esc cancels.
  - Focus then moves to the new block, so Enter opens its editor.
  - The slot stops propagation of its keys, so the window keyboard map is untouched.
- `.tl-inner` gets `user-select: none` and `-webkit-touch-callout: none` so a press-drag never selects text or opens the iOS callout.

**Tests**
- `tests/unit/paint.test.ts` (5) covers snap at 5/10/15, upward drags, the minimum length, the day clamp and px→min at 66 and 72 px/h.
- `tests/paint.spec.ts`, with a pinned clock of 12:00 and the seeded day:
  - **Desktop mouse:** 17:02 → 17:43 shows the ghost label "17:00–17:45" mid-drag, with transform only and no `top`/`height`. Release creates exactly one task at 17:00 for 45 min, with no draft sheet. The block is selected and reads "Untitled"; a click opens TaskSheet at 17:00.
  - **Desktop:** an upward drag paints 17:10–17:50. A plain click (under 4 px) still opens the draft at 20:30, with no extra task.
  - **Desktop keyboard:** slot at 12:00, ↓×3 gives "Empty slot 12:15". Enter then Esc cancels and creates nothing. Enter, ↓×5 gives "12:15–12:45", and Enter creates 12:15 for 30 min. Focus moves to the new block and Enter opens the sheet. **axe** reports no serious or critical issues mid-paint or after creation.
  - **iPhone 15 (WebKit):** a touch pointer that moves 30 px before the hold creates nothing. A held one paints 17:00–17:45.
  - **Desktop perf:** 5 000 tasks + 200 series loaded; 60 pointer moves of a paint across the busy evening. The result is below.
- `tests/paint-touch.spec.ts` runs the iPhone 15 profile in **Chromium**, because CDP touch is Chromium-only and the project is WebKit. It uses real `Input.dispatchTouchEvent`:
  - A quick swipe scrolls the timeline (scrollTop +60 px or more) and paints nothing.
  - A 650 ms hold then a drag paints "17:00–17:30". The timeline does not scroll while painting. Release creates 17:00 for 30 min, and a tap opens TaskSheet.
- The existing timeline, snags, snags3, snagtrain, perf and review2 specs all pass (90/90 ad hoc), so click-to-create and the free gaps are unchanged.

**Perf** (`docs/evidence/arc5a-slice-4-paint-perf.json`, desktop Chromium, 5k library)

| measure | value | budget |
|---|---|---|
| rAF frame p50 / p95 / max | 16 / 18 / 20 ms | p95 ≤ 20 ms |
| long tasks > 50 ms while painting | 0 | 0 |
| DOM insertions/removals in `.tl-inner` while painting | 0 | 0 (no re-render storm) |
| ghost style | `translate3d(…)`, fill `scaleY(…)`, no top/height | transforms only |

The frame times come from `page.clock`'s pinned `performance.now()`, which reports whole milliseconds.

**Gauntlet** `PORT=4183 PRESS_DIR=… PW_WORKERS=3 scripts/gauntlet.sh arc5a-slice-4`, stamp 20261003-133942: **GREEN**
- 🟢 unit (vitest): 20 files, 370 tests · 🟢 build · 🟢 press launcher + publish-checks · 🟢 edge functions (17 ok)
- 🟢 both secret gates · 🟢 Playwright smoke + axe: 223 passed, 119 skipped (project-scoped)
- 🟢 Lighthouse desktop perf 100 / a11y 100 · 🟢 mobile perf 98 / a11y 100

**Screenshots** (`EVIDENCE=1`, ghost mid-drag)
- `arc5a-slice-4-ghost-desktop.png`: a mouse paint over the 16:45–18:00 free gap.
- `arc5a-slice-4-ghost-iphone-15.png`: a long-press touch paint, iPhone 15 profile (Chromium, from `paint-touch.spec.ts`).
