# ai-planner slice 2 — Fixes #29 (ST-P1-1): iPhone inbox footer hint

Fix: `src/styles/app.css` — `.is-mobile .backlog .ft { display: none; }`. The hint ("Drag onto the board, or **Place** …")
is desktop copy and sat under the floating tab bar; on iPhone, Place is the row's pill + swipe, so nothing is lost.
Desktop keeps the hint.

Test: `tests/snags3.spec.ts` "#29 …" — iPhone 15: `.backlog .ft` hidden; desktop: visible.

Gauntlet `ai-planner-slice-2` (20261003-032045) — GREEN: vitest 328 · build · press + publish-checks · deno · secret gate ·
Playwright 169 passed (desktop + iPhone 15, axe) · Lighthouse desktop 100/100, mobile 98/100.

Note: three earlier runs went red on scattered timeouts / context-teardown errors while another project's Playwright
loop and a NAS rsync loaded the machine (load avg 7–13). `playwright.config.ts` gains `PW_WORKERS` to cap
parallelism on a shared machine; this run used `PW_WORKERS=2`.
