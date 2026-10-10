# HANDOFF — optimo

## Current state
- Merge state: Merged: PR #112 ce67e23 on 2026-10-09; main checkout on main @ 304025f (wave-0 close-out: docs-only on main, PR N/A)
- Arc 7 — **Inbox-first** shipped from the cloud (cloud is the primary home). Live: Pages `<meta name="build">` =
  `ce67e23` (= merge SHA, checked 2026-10-09). Supabase: `db/008_inbox_first.sql` applied; plan-day still v7
  (ezbr `aab12198…`).
- **Wave-0 close-out (2026-10-10, Mac):** the Mac checkout is current with origin and clean; no agent worktrees or
  `slice-*` / `worktree-agent-*` branches left. Mac gauntlet GREEN on the arc 7 code — unit, build, press launcher +
  publish-checks, edge (deno), secret gates, Playwright + axe (desktop + iPhone 15), Lighthouse 100/100 · 96/100
  (log `docs/evidence/gauntlet-gauntlet-20261010-152529.log`, git-ignored). Sentry: 0 hits.

## Shipped this arc (wave-0 close-out)
1. S1 — stranded files landed: the verify evidence was already on origin byte-identical (dc9016a) → local copy dropped,
   main fast-forwarded f153010 → f959467; arc 6 verify line + Garrick's [sheet≠image] call re-applied to HANDOFF;
   `.claude/settings.local.json` + `.claude/worktrees/` gitignored — 304025f.
2. S2 — worktree sweep: 4 arc-6 agent worktrees removed (no --force), 4 `worktree-agent-*` branches deleted by
   project-drift, `slice-2-header` / `-4-panel` / `-5-tabbar` / `-6-wizard` deleted (SAFE: cherry / subject / range-diff
   — 4/5/6 differed only in sibling-slice merge context).

## Open / blockers (close-out manifest)
- **push: DONE** · **PR / merge / reconcile / stage stamp: N/A** — docs-only commits straight on main (arc.md rule 4).
- **migrations / Edge deploys / Pages deploy: N/A** — no app code, SQL or function changed (Pages `paths-ignore` docs).
- **press publish-check: DONE** — the Mac gauntlet's launcher build + publish-checks are green (closes arc 7's cloud gap).
- **Inbox cleanup: N/A** — not a worktree; ARC.md was committed in 304025f and is truncated by this close.
- **Worktree sweep: DONE** — `git worktree list` = main only.
- **Local branch kept:** `arc/snag-train-2026-10` — fully merged (no `+` vs main), outside this order's pattern; any
  later sweep may `git branch -d` it.
- **No `Home:` line** on CLAUDE.md Current stage — the migrate instrument adds `Home: github:schnubsy/optimo` (B1).
- **Arc 6 verify:** DONE 2026-10-09, green (`docs/evidence/verify-2026-10-09.md`). Garrick's call on the
  [sheet≠image] snags (#81, #82, #83, #85, #87, #91, #95, #108): the image wins.
- **Known, not fixed (arc 7):** #51 AI tab nests the timeline scroller · #70 tab bar see-through (real-Safari look) ·
  Week at 1024 wide is icon-only (columns < 110 px) · nested-lane titles squeezed to ~91 px · #47 "1:30" durations ·
  tray chips one per row on iPhone · watch: a stray empty wizard seen once after drag → Escape → Week.
- **Snags:** #81–#110 (arc 6 P1), #67–#79, #57, #59–#65, #39–#54 carried.

## Exact next steps
1. **B1 — migrate:** add the `Home: github:schnubsy/optimo` line (the migrate instrument).
2. Mark: real-iPhone checks below; anything failing → a `snag` Issue or tell the next session.
3. **Next arc — timeline & week polish:** "kick off" builds it from `docs/backlog/2026-10-10-mark-feedback.md` (F1 Day
   proportional time scale · F2 Week hours fill the height · F3 now-line + elapsed shading back · F4 ←/→ keys step by
   week/month) plus the known-not-fixed list above. Mark adds any further UI tweaks at that kickoff.
4. Then **arc 5b — people** ("kick off — arc 5b"), dispatched to the cloud home (`HOME:` + `BRANCH:` header).

## Mark's manual steps
1. **Real-iPhone checks (installed PWA):**
   - FAB → type `Call plumber` → Enter → it's in Inbox (badge +1), the field stays open.
   - FAB → `Movie night at 8pm for 1.5h` → chip shows the time → Enter → 8:00–9:30 PM on the timeline.
   - Inbox → tap a row → Today → it appears in Timeline's "To place" tray; drag it onto a time.
   - Overlapping tasks: tap each ring — the task beside it completes, nothing else.
   - Tab bar: is text behind it readable? (#70) · notch/home-indicator spacing on Timeline, wizard, capture sheet.
