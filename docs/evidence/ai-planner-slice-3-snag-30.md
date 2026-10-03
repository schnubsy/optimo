# ai-planner slice 3 — Fixes #30 (ST-P1-2): brand mark chip no longer reads as a toggle knob

Fix (`src/icons/brand.svg`, original drawing): the white disc is gone. The chip is now a darker coral disc (`#8f3a2e`,
r 3.2, inset 1.5 from the top pill's left end, wholly inside the pill height) with one white tick counter-cut. The
bottom pill moves to y 21.5, which leaves a 1.5-unit gap between the pills. The blush ground and sage dot are kept.
Regenerated: `public/favicon.svg` and `public/icons/{apple-touch-icon,icon-192,icon-512,maskable-512}.png`
(`npx tsx scripts/make-icons.ts`), plus the launcher via `npm run build:press`.

Evidence: `ai-planner-slice-3-brand-mark.png` shows 512 px, 32 / 16 / 64 px and the maskable icon. At 16–32 px the
tick sits inside the pill, and the two pills read as stacked blocks, not a switch.

Test: `tests/unit/brand.test.ts` "#30 chip inside the pill" checks no white disc, the chip's r, inset and containment,
the pill gap ≥ 1.5 and that the sage dot is present.

Gauntlet `ai-planner-slice-3` (20261003-033904): GREEN (PW_WORKERS=2). Lighthouse 100/100 · 98/100.

Close-out impact: the launcher (`dist/optimo.html`, press `optimo.html`) carries the mark, so **publish** is a close
item after merge (launcher republish).
