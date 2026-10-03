# ai-planner slice 8 — Fixes #35 (ST-P2-4): Week (desktop) header row gets the body's right pad

Fix (`src/styles/app.css`): `.is-desktop .whead { padding-right: var(--sp-4); }`. It matches `.wbody`, so Sun's
header ("Sun 4 · 16h00 free") ends over its own column and no longer runs to the window edge.

Test (`tests/snags3.spec.ts` "#35", desktop): the header's right padding equals the body's, and the last day header's
right edge is within 2px of the last column's. **It fails on the old CSS** (`Expected "16px" / Received "0px"`) and
passes with the fix.

Gauntlet `ai-planner-slice-8` (20261003-035658): GREEN.
