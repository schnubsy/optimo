# ai-planner slice 9 — Fixes #36 (ST-P2-5): Month (iPhone) title on the 16pt gutter; ‹ › keep an edge

Fix (`src/styles/app.css`):
- `.is-mobile .mhead { padding-inline: var(--sp-2) }` — 8pt month pad + 8 = the header's 16pt gutter.
- `.mhead .nav { box-shadow: inset 0 0 0 1px var(--line) }` — the arrows no longer vanish on blush in light.

Test (`tests/snags3.spec.ts` "#36", iPhone 15, light): "Oct 2026" starts within 1px of the header title's left edge,
and the nav buttons carry an inset edge. **Fails on the old CSS** (8px off) and passes with the fix.
Evidence: `ai-planner-slice-9-month-iphone-15-light.png`.

Gauntlet `ai-planner-slice-9` (20261003-035935): GREEN.
