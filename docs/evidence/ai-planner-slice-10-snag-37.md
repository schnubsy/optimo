# ai-planner slice 10 — Fixes #37 (ST-P2-6): toasts no longer cover open sheets

Fix (`src/styles/app.css`): `.toast-wrap { z-index: 35 }`, down from 60. That puts toasts above the tab bar / FAB
(30) and under sheets (40). A toast can no longer sit over a sheet's × ("iCloud calendar connected." over the
event sheet). Toasts raised by a sheet action already fire after the sheet closes (the Undo pattern).

Test (`tests/snags3.spec.ts` "#37", desktop + iPhone): with the editor sheet open and a toast raised, toast z <
sheet z, toast z > tab bar z (iPhone), and a hit test on the sheet's Close button lands on Close. **Fails on the old
CSS** (`Expected < 40 / Received 60`) and passes with the fix.

Gauntlet `ai-planner-slice-10` (20261003-040206): GREEN.
