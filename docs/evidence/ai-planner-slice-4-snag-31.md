# ai-planner slice 4 — Fixes #31 (ST-P1-3): evidence race + editor Category-row flash

Diagnosis: two causes.
1. **Real flash.** `SheetForm` ran its own `useCategories()` live query, so it mounted with `[]` and filled the
   Category row a frame later (a ~40px layout shift). Proof: the new test, which records the chip count in the very
   mutation that inserts the sheet, **fails on the old code (0 chips) and passes on the fix (8)**.
2. **Capture race.** The Month (light) capture fired before the month live query painted the dots.

Fix:
- `TaskSheet` takes Planner's already-resolved `cats` (`src/editor/TaskSheet.tsx`, `src/Planner.tsx`). No second
  query and no empty row.
- The capture spec (`tests/snagtrain.spec.ts` #24 evidence) waits for `.mday.today .dots i` and for
  `[data-testid=sheet-category] button` before each shot.

Tests (`tests/snags3.spec.ts`): the "#31 editor mounts with its Category row already filled" check runs on desktop and
iPhone. "#31 Month paints today's category dots" runs in light and dark: 4 dots + "+6" on the seeded day in both.

Gauntlet `ai-planner-slice-4` (20261003-034225) — GREEN: vitest 332 · deno · Playwright 175 · Lighthouse 100/100 · 98/100.
