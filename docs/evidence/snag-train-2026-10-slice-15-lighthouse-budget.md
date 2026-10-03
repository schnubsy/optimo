# Snag train 2026-10 · slice 15: performance budget

Run: `scripts/gauntlet.sh snag-train-2026-10-slice-15` (20261002-224844) on head aacb927 (slices 1–14), built page via
`vite preview`. Raw reports: `snag-train-2026-10-slice-15-lighthouse-{desktop,mobile}-20261002-224844.json` (gitignored,
local). Budget gate: perf ≥ 85 · a11y ≥ 90.

| Form factor | Perf | A11y | Best pr. | SEO | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|---|
| desktop — this arc | **100** | **100** | 100 | 100 | 0.4 s | 0.4 s | 0 ms | 0 |
| desktop — arc-2 baseline (HANDOFF) | 100 | 100 | — | — | 0.4 s | 0.4 s | 0 ms | 0 |
| mobile — this arc | **98** | **100** | 100 | 100 | 2.0 s | 2.1 s | 0 ms | 0.001 |
| mobile — arc-2 baseline (HANDOFF) | 98 | 100 | — | — | 2.0 s | 2.1 s | 0 ms | 0.001 |

Every per-slice gauntlet in this arc (slices 1–14) also scored 100/100 desktop and 98/100 mobile.

**Verdict:** 🟢 no regression vs the recorded baseline (100/100, 98/100); no exception needed.
