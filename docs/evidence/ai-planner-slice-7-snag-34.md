# ai-planner slice 7 — Fixes #34 (ST-P2-3): `meeting-handshake` reads as hands, not a bow tie

Fix (`src/icons/set.ts`, original drawing, nothing traced from an icon library): two forearms rise from the lower
corners into a clasp tilted 20°. Three knuckle bumps sit on top, and one diagonal finger counter-cut crosses the
join (§6.1: one counter-cut). The old outline, two lobes and a band, is gone.

Evidence: `ai-planner-slice-7-handshake.png` shows before (top) and after (bottom) at 13 / 18 / 22 / 96 px on the
salmon chip. `icons.png` is the regenerated review sheet (`npx tsx scripts/icon-sheet.ts`).

Test (`tests/unit/icons.test.ts` "#34"): the old band path is gone, the clasp carries `rotate(-20`, and the clasp
path has exactly two subpaths (outline + one counter-cut). It also passes the suite's existing checks: 24 viewBox, no
external refs, every coordinate on the canvas.

Gauntlet `ai-planner-slice-7` (20261003-035437): GREEN. The first run lost the offline spec to a dropped `offline`
event under load; that spec passes 3/3 in isolation.
