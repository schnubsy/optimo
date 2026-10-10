# HANDOFF — optimo

## Current state
- Merge state: Merged: PR #112 ce67e23 on 2026-10-09; main checkout on main @ ce67e23 (cloud session; the Mac pulls)
- Arc 7 — **Inbox-first**: 10 slices done, built entirely in a cloud session (cloud is now the primary home; the Mac
  only pulls). Gauntlet in cloud mode: unit 528 🟢, Lighthouse 100/100 · 97/100 🟢, Playwright reds are cloud-only
  (`docs/evidence/arc7-gauntlet-summary.md`). Independent QA re-walk: no P0, no blocking P1.
- Live: Pages `<meta name="build">` = `ce67e23` (= merge SHA, checked 2026-10-09).
- Supabase: `db/008_inbox_first.sql` applied (`optimo_008_inbox_first`, 20261009225222 —
  `docs/evidence/arc7-db008-apply.md`). No Edge redeploy this arc (plan-day still v7, ezbr `aab12198…`).

## Shipped this arc
1. Cloud mode: Playwright on the cloud's Chromium (`PW_CHROMIUM`), Lighthouse via `CHROME_PATH`, deno via npm — dc9016a.
2. Day timeline: text + ring beside their own node in overlaps, rail labels clean, events tappable, iPhone grabber /
   all-day / peek — 3a854f6, 70e9ddc.
3. Chrome: 1024 header, wizard action always visible + desktop dialog, settings fit, no header on AI/Settings,
   week/month stepping, TZ search, Escape scoped — fed75fb.
4. Drops at the pointer, edge-dwell auto-scroll, live drag time — 7dcd392.
5. Readable week: titles, lanes, planned · free, now-line, all-day + events, week "To place" trays — d9bd7d5.
6. iPhone Inbox badge; ③ place control (Inbox · Today · Tomorrow · Pick day · Someday · Timeline) — 8364a21.
7. Data: plan_date / someday / estimated, Dexie v5, derived place, pre-008 degrade — f4a6427, 9feb9a5.
8. One-line capture (FAB / N / command line) + inbox processing + Someday section — b381a34.
9. Day "To place" tray: drag, Place, Pick a time, tomorrow / inbox / someday, Fit with AI — a4e08e9.
10. QA fixes (tray contrast, placed-toast date/clock, no past default time) + evidence — 01fc94d.

## Open / blockers (close-out manifest)
- **migrations: DONE** — db/008 applied by this session via the connector (proof above). No destructive SQL.
- **Edge deploys: N/A** — none changed.
- **push · PR · merge · Pages ship proof: DONE** — PR #112 merged as ce67e23; live build meta = ce67e23.
- **press publish-check:** not run in the cloud (no sibling `press` checkout); `dist/optimo.html` is unchanged this arc.
- **Mac checkout:** an old local copy, unused now (cloud is primary); a future Mac session refreshes it itself.
- **Known, not fixed:** #51 AI tab nests the timeline scroller · #70 tab bar see-through (needs a real-Safari look) ·
  Week at 1024 wide is icon-only (columns < 110 px) · nested-lane titles squeezed to ~91 px · #47 "1:30" durations ·
  tray chips one per row on iPhone · watch: a stray empty wizard seen once after drag → Escape → Week.
- **Snags:** #81–#110 (arc 6 P1), #67–#79, #57, #59–#65, #39–#54 carried.

## Exact next steps
1. Mark: real-iPhone checks below; anything failing → a `snag` Issue or tell the next session.
2. **Next arc — timeline & week polish:** "kick off" builds it from `docs/backlog/2026-10-10-mark-feedback.md` (F1 Day
   proportional time scale · F2 Week hours fill the height · F3 now-line + elapsed shading back · F4 ←/→ keys step by
   week/month) plus the polish list in Open / blockers. Mark adds any further UI tweaks at that kickoff.
3. Then **arc 5b — people** ("kick off — arc 5b"). Cloud sessions need no `MAIN CHECKOUT:` line.

## Mark's manual steps
1. **Real-iPhone checks (installed PWA, after the Pages deploy):**
   - FAB → type `Call plumber` → Enter → it's in Inbox (badge +1), the field stays open.
   - FAB → `Movie night at 8pm for 1.5h` → chip shows the time → Enter → 8:00–9:30 PM on the timeline.
   - Inbox → tap a row → Today → it appears in Timeline's "To place" tray; drag it onto a time.
   - Overlapping tasks: tap each ring — the task beside it completes, nothing else.
   - Tab bar: is text behind it readable? (#70) · notch/home-indicator spacing on Timeline, wizard, capture sheet.
2. **Mac folder: nothing to do.** `~/Documents/code/optimo` is an old local copy; the cloud and the live site don't use
   it. Only if a future session works on the Mac does it need refreshing — that session does it itself.
