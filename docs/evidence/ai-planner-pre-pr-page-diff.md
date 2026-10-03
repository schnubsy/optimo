# ai-planner — PRE-PR page-diff gate (branch vs live Pages build `e17b434`)

`PAGEDIFF=<dir> npx playwright test tests/pagediff.spec.ts` + `node scripts/page-diff-gate.mjs <dir> --touched …`.
Same hermetic seed, a frozen 10:30 clock and frozen animations on both sides, desktop 1280×800 + iPhone 15.

| view-viewport | diff | why it moved (slice) | gate (≤ 2 %) |
|---|---|---|---|
| day-desktop | 0.19% | Plan button in the pane header (13); running pill over the now line (5, #32) | 🟢 |
| day-iphone-15 | 0.81% | fifth tab "Plan" in the bar (13); #32 | 🟢 |
| inbox-iphone-15 | 0.70% | desktop hint hidden (2, #29); tab bar | 🟢 |
| month-desktop | 0.01% | arrow edge (9, #36) | 🟢 |
| month-iphone-15 | 0.90% | 16pt gutter + arrow edge (9, #36); tab bar | 🟢 |
| quickadd-desktop | 1.06% | header Plan button narrows the quick-add pill (13) | 🟢 |
| quickadd-iphone-15 | **6.19%** | 44px parse chips (6, #33): an intended layout change, pre-justified in the Issue | 🟡 intentional |
| settings-desktop | 0.02% | Planning card below the fold (14) | 🟢 |
| settings-iphone-15 | 0.57% | tab bar | 🟢 |
| week-desktop | 0.35% | header right pad (8, #35) | 🟢 |
| week-iphone-15 | 0.56% | tab bar | 🟢 |

RESULT: **GREEN**. Every view stays ≤ 1.06% except the one intended layout change (#33). Diff images:
`ai-planner-pagediff-{quickadd,day}-iphone-15-diff.png`.
