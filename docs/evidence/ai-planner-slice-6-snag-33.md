# ai-planner slice 6 — Fixes #33 (ST-P2-2): quick-add parse chips are 44px tall on iPhone

Fix (`src/styles/app.css`): in the iPhone quick-add sheet, the parse-preview chips (`.parse > b`, `.f`, and the chip
`span`s) get `min-height: 44px`. That matches spec §5.10 and the sheet's other 44px controls. The desktop popover
keeps its compact 28px chips.

Test (`tests/snags3.spec.ts` "#33", iPhone 15): after `getAnimations().length === 0` (lessons: measure after
animationend), every chip is ≥ 44px tall and its bottom edge is inside the viewport.
Evidence: `ai-planner-slice-6-quickadd-iphone-15.png`.

Gauntlet `ai-planner-slice-6` (20261003-034952): GREEN (PW_WORKERS=2). Lighthouse 100/100 · 98/100.
