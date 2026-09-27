# Lessons — optimo

_Append-only. One line per lesson: `- YYYY-MM-DD [tag] lesson`. Tags: [git] [supabase] [sync] [dnd] [pwa] [perf] [design] [test]_
- 2026-09-26 [git] RULE: originality gate — no Structured.app (or any planner's) look, copy, icon set or naming; icons drawn in-repo (`src/icons/glyphs.tsx`).
- 2026-09-26 [supabase] RULE: only `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (publishable) in the client; every other secret is server-side.
- 2026-09-26 [supabase] RULE: Code never applies DDL; `db/*.sql` is committed by Code and applied by Cowork.
- 2026-09-26 [git] GitHub Pages on a private repo needs a paid plan; optimo went public (Mark's call). `workflow_dispatch` only works once the workflow is on the default branch — first deploy = push to main.
- 2026-09-26 [test] Magic links can't be clicked by tests and shared storageState breaks on refresh-token rotation: gate UI/sync specs on a hermetic Supabase fake (PostgREST + sync_log + Phoenix v2 realtime via `routeWebSocket`) that reuses the client's `mergeRow`; keep a `@real` spec behind a gitignored `.env.test.local`.
- 2026-09-26 [pwa] Playwright cannot route requests from SW-controlled pages in WebKit: set `serviceWorkers: 'block'` by default and opt in only for the offline spec (Chromium) — otherwise the hermetic fake silently stops seeing traffic.
- 2026-09-26 [dnd] dnd-kit measures droppables ignoring CSS transforms: virtualised rows that are droppable must be positioned with `top`, not `translateY`, or every row measures at y=0.
- 2026-09-26 [dnd] Custom collision: prefer inbox-row droppables over the inbox container and exclude the dragged row's own droppable, else reorder never fires.
- 2026-09-26 [sync] Seed rows (default categories) carry `field_ts = 1` per field and fixed ids, and seed only after the first sync attempt, so a fresh device never out-votes real edits.
- 2026-09-26 [sync] rrule in "floating" time: feed dtstart as UTC carrying local wall-clock and read results back the same way — 09:00 series stay 09:00 across DST. Pin vitest `TZ` to a DST zone so the test means something.
- 2026-09-26 [design] Selected-state rules like `.x [aria-pressed='true']` lose to `.x .seg button` on specificity — write `.x .seg button[aria-pressed='true']` and guard with a computed-style assertion.
- 2026-09-26 [design] A mobile `grid-template-columns: 1fr` track grows to its content (`minmax(auto,1fr)`); use `minmax(0,1fr)` or horizontal scrollers never scroll.
- 2026-09-26 [test] Sheet/dialog fade-in with opacity makes axe report blended contrast mid-animation; animate transform only.
- 2026-09-26 [perf] Lighthouse 13 has no PWA category — prove installability with CDP `Page.getInstallabilityErrors` = [] instead.
- 2026-09-26 [test] Evidence screenshots are opt-in (`EVIDENCE=1`) so gauntlet runs don't rewrite tracked PNGs; restore any a later run overwrote before committing.
