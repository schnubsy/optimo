# arc1 · slice 6 — offline PWA + performance at scale (2026-09-26)

## Gauntlet (`scripts/gauntlet.sh arc1-s6`, 20260926-200856) — GREEN
- 🟢 unit (vitest) — 73 tests
- 🟢 build (vite) — PWA v1.3.0, 15 precache entries (app shell, icons, manifest)
- 🟢 playwright smoke + axe (desktop, iPhone 15) — 48 passed, 20 skipped
- 🟢 lighthouse desktop perf=100 a11y=100 (LCP 0.4 s, TBT 0 ms, CLS 0) — `arc1-slice-6-lighthouse-desktop.json`
- 🟢 lighthouse mobile perf=98 a11y=100 (LCP 2.0 s, TBT 0 ms, CLS 0) — `arc1-slice-6-lighthouse-mobile.json`
  (Lighthouse 13 has no PWA category; installability is asserted in offline.spec via Chrome's own
  `Page.getInstallabilityErrors` → `[]`.)

## Perf budgets — tests/perf.spec.ts, `scripts/seed.ts` library (5 000 tasks + 200 series), Chromium desktop

| budget | measured | limit | result |
|---|---|---|---|
| day view ready after data (max of 6 day switches, `performance.measure('optimo:day-ready')`) | 14.5 ms | < 200 ms | 🟢 |
| inbox filter → rendered (max of 4 queries over 1 262 inbox rows) | 1.2 ms | < 50 ms | 🟢 |
| drag: 60 pointer moves, long tasks > 50 ms | 0 | 0 | 🟢 |
| drag moves the slab by transform only | yes | yes | 🟢 |
| rAF frames delivered during the drag | 60 | — | info |

Raw per-run numbers: `arc1-slice-6-perf-desktop.md`. Timeline blocks outside viewport ± 1 screen and inbox rows outside
the scroll window are not mounted; all task reads are Dexie range queries on `start_at` / `_kind`.

## offline.spec.ts (Chromium; service worker allowed)
- online load → SW controls the page → **offline**: quick-add create at 15:00, ↓ nudge Lunch +5 min, complete Stand-up;
  badge "Offline, n queued"
- **reload while offline**: shell from the SW precache, all three changes read back from IndexedDB; server untouched
- **online**: outbox flushes, badge `synced`, server rows carry the changes; a **second context** pulls and shows the
  offline-created block
- installable: manifest (standalone, `/optimo/` scope, 192 / 512 / maskable-512 icons all 200), active SW,
  `Page.getInstallabilityErrors` = []

## Test-harness note
Playwright cannot route requests from SW-controlled pages in WebKit, so `serviceWorkers: 'block'` is the default and
only offline.spec opts in (Chromium). This keeps the hermetic Supabase fake fail-closed on iPhone runs.
