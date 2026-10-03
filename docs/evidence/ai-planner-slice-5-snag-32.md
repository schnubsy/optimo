# ai-planner slice 5 — Fixes #32 (ST-P2-1): the now line no longer strikes through the running pill's title

Fix (`src/styles/app.css`): `.pill.run, .pill.run.sel { z-index: 7 }`. The running pill now paints above the now line
(z 6), so the line stops at the pill's edges. Inside the pill, the elapsed sweep's flat edge (#27) already marks now.
This is the Issue's second option, and the safer one. A text-shadow halo can't break a line that is painted on top of
the text.

Test (`tests/snags3.spec.ts` "#32"): with the clock pinned at 14:30 inside a 14:00–15:30 pill, a hit test where the
now line crosses the pill's middle lands on the pill. It **fails without the fix and passes with it**, on desktop and
iPhone.

Evidence: `ai-planner-slice-5-running-pill-{desktop,iphone-15}.png`.

Gauntlet `ai-planner-slice-5` — GREEN (vitest 332 · deno · Playwright 177 · Lighthouse 100/100 · 98/100). The first
run lost two desktop specs to "browser has been closed", which was the Chromium process being killed externally.
