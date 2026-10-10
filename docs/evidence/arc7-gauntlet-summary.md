# Arc 7 — gauntlet (cloud mode, 2026-10-09)

Full run `arc7-gauntlet-20261009-190316` (build aae94b8, run while an independent QA agent was also running):
unit 🟢 · build 🟢 · edge functions (deno via npm) 🟢 · secret gates 🟢 · Lighthouse desktop 100/100, mobile 97/100 🟢 ·
Playwright 382 passed / 10 failed / 184 skipped (project-specific skips).

The 10 reds — none product:
- smoke ×2: Google Fonts unreachable through the cloud proxy (console error) — env; same on baseline f153010.
- offline ×3 (installable ×2, offline + reconnect on iPhone): cloud Chromium installability (`in-incognito`) — env; baseline too.
- 5k perf / paint budgets ×3: machine load. Re-run alone: green.
- sync ×2 (`__optimo` undefined mid-test): machine load. Re-run alone: green.
- press launcher publish-check: needs the sibling `press` checkout (`PRESS_DIR`), not available in this cloud session.

Solo re-run after the QA fixes (sync, perf, paint, arc7-week, arc7-capture, arc7-chrome, arc7-timeline; both projects;
PW_WORKERS=1): 85 passed, 1 failed (iPhone 5k perf), which passed on its own re-run.

Independent QA re-walk (a fresh agent, build aae94b8): every baseline P0/P1 is fixed except #51 (AI tab nests the
timeline scroller), #70 (tab bar see-through — needs a real-Safari look), Week at 1024 wide (columns < 110 px →
icon-only) and the nested-lane title squeeze. New P2s fixed in the follow-up commit: tray estimate contrast (axe), the
"Placed at" toast (raw ISO date, ignored 12-hour setting), ③ Inbox → Timeline defaulting to a past time.
Inbox-first flow verified end to end on both surfaces, zero console errors.
