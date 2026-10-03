# Snag train 2026-10 · PRE-PR gate: page-diff

Branch head 58b4304 (slices 1–15) vs CURRENT-LIVE `https://schnubsy.github.io/optimo/` (live build `636a4ce`).
Both sides render the same seeded day (`seedDay`) on the hermetic Supabase fake, clock frozen at 10:30 today, animations
off, at desktop 1280×800 and iPhone 15 (390×844 viewport). Capture: `PAGEDIFF=<dir> npx playwright test tests/pagediff.spec.ts`;
diff: `node scripts/page-diff-gate.mjs <dir> --touched day,week,settings,quickadd`, which uses press's
`tools/page-diff.mjs` `diffPngs` (pixelmatch 0.1) at the 2% threshold. 🔴 only for a view NOT touched by slices 1–13.

| view-viewport | diff | touched by slices 1–13 | gate (≤2%) |
|---|---|---|---|
| day-desktop | 0.00% | yes | 🟢 |
| day-iphone-15 | 0.09% | yes | 🟢 |
| inbox-iphone-15 | 0.08% | no | 🟢 |
| month-desktop | 0.00% | no | 🟢 |
| month-iphone-15 | 0.07% | no | 🟢 |
| quickadd-desktop | 0.00% | yes | 🟢 |
| quickadd-iphone-15 | 4.01% | yes | 🟡 intentional |
| settings-desktop | 0.00% | yes | 🟢 |
| settings-iphone-15 | 1.41% | yes | 🟢 |
| week-desktop | 1.63% | yes | 🟢 |
| week-iphone-15 | 2.29% | yes | 🟡 intentional |

Over-threshold diffs (both touched, pre-justified): `snag-train-2026-10-pagediff-quickadd-iphone-15-diff.png` (slice 9 —
44px parse-chip hit targets + slice 2/3 glyphs) and `snag-train-2026-10-pagediff-week-iphone-15-diff.png` (slice 8 —
scroll-snap + gutter padding). The untouched views (Inbox, Month) differ ≤ 0.08% — only the redrawn tab-bar glyphs
(slice 2) and activity glyphs (slice 3), which are shared chrome.

**Launcher card (slice 11):** `node ~/Documents/code/press/tools/page-diff.mjs dist/optimo.html
https://schnubsy.github.io/press/optimo.html` → desktop 0.000%, mobile 0.000%, PASS. Caveat: without a Family Wing
session both sides render the shared sign-in gate, so this pass cannot see the card itself; the card change is covered
by the slice-11 evidence and is intentional. The live launcher still carries the pre-slice-12 brand mark until
`press/optimo.html` is republished after merge.

**Verdict:** 🟢 GREEN — no untouched view changed beyond 2%.
