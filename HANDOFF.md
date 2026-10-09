# HANDOFF — optimo

## Current state
- Merge state: Merged: PR #111 9b8a3f1 on 2026-10-09; main checkout on main @ 9b8a3f1
- Arc 6 — **UI/UX round (spine timeline, panel sheet, 4-tab bar, task wizard)**: all 9 slices done, each with a GREEN
  gauntlet (last: Lighthouse desktop 100/100, mobile 97/100); sentry (secrets scan of the whole arc diff) 0 hits.
- Live before the merge: Pages `<meta name="build">` = `4f04493`.
- Supabase: `db/007_task_tz.sql` applied (`optimo_007_task_tz`, 20261009181817, max(version) unchanged —
  `docs/evidence/arc6-db007-apply.md`); plan-day **v7** live, ezbr `087d34a0…` → `aab12198…`
  (`docs/evidence/arc6-slice-8-plan-day-deploy.md`).

## Shipped this arc
1. Tokens from the measured mockups (#000 / #1C1C1E / #EC9792, light mirror, culori a11y layer), 10 new + 3 restyled
   glyphs, originality rule rewritten (CLAUDE.md, lessons, spec §6) — 3ffe2d3.
2. Header `October 9, 2026 ›`, 32 px accent disc, mini-chips, stats line removed — 2ae5a87.
3. Spine timeline on one segment map (`src/timeline/segments.ts`): bookends (names in Settings → Day, per-day ring),
   discs / capsules, compressed gaps with our copy + Add Task, ring completes, chip opens — ddaa8b4.
4. Two-detent PanelSheet over the spine week overview; desktop Week = spine columns — bd87537.
5. 4 tabs (Inbox · Timeline · AI · Settings), 58 px FAB, inbox empty state + node rows — a072b4c.
6. Wizard ① title (parser) + suggestions, ② wheel / ••• menu / duration presets — 7870679.
7. ③ details = the edit screen (TaskSheet removed), per-task time zone + picker, db/007, Dexie v4 — 66221a0.
8. AI subtasks: plan-day `subtasks` (Haiku, strict tool, 30/day), sparkle → Keep all / Discard — 745668b.
9. Eye LITE vs the ten mockups (`docs/evidence/arc6-eye-lite.md`): 8 P0 fixed (9b), 30 P1 → snags — 8f7d145.

## Open / blockers (close-out manifest at branch time)
- **migrations: DONE** — db/007 applied by Code via the connector (proof above). No destructive SQL this arc.
- **deploy (Edge plan-day): DONE** — v7, ezbr `aab12198…`; the v7 module answers its own 401 to a non-user key.
- **push · PR · merge · reconcile main · Pages ship proof · press publish check · inbox cleanup:** run by the arc-close
  order straight after this commit; their outcomes are in the close report and checked by `Cowork: run verify`.
- **Inbox cleanup: N/A** — the main checkout is not a worktree; ARC.md + the mockups were committed in 751b1b9.
- **Worktrees:** four agent worktrees under `.claude/worktrees/` (slices 2, 4, 5, 6) are kept — the order
  forbids removing worktrees inside it; their branches are fully cherry-picked (SAFE). The next worktree sweep owns them.
- **Snags:** Eye arc 6 P1 #81–#110 (several tagged [sheet≠image] need Mark's call: sheet value or image value), plus
  #67–#79, #57, #59–#65, #39–#54 carried.

## Exact next steps
1. ~~`Cowork: run verify` on the merged build~~ — DONE 2026-10-09, verified green (`docs/evidence/verify-2026-10-09.md`, uncommitted — Code commits it next session). Garrick's call on the [sheet≠image] snags: the image wins.
2. Mark: the on-device checks below. Anything failing → a `snag` Issue.
3. Mark decides the [sheet≠image] snags (#81, #82, #83, #85, #87, #91, #95, #108): type scale, 72 px row minimum,
   panel margin, mini-chip fill. Then a snag train.
4. **Arc 5b — people** (kick off with "kick off — arc 5b"): people picker, per-person sync + the guarded
   `planner_flags.family_access` flip, per-person iCloud, register plan-day in `press_agent_registry`. Any Claude Code
   prompt carries `MAIN CHECKOUT: /Users/mark/Documents/code/optimo` + `INBOX FILES:` and pulls `main` before branching.

## Mark's manual steps
1. **On-device checks (iPhone, installed PWA)** — after `Cowork: run verify` is green:
   - Tab bar + FAB sit ~22 px above the bottom edge (over the home indicator), not ~50 px (Eye P0-8).
   - Timeline: drag the grabber down → week overview; tap a day column → that day, panel up; tap Timeline again → toggles.
   - FAB → `Movie night at 8pm for 1.5h` → Continue → Continue → Create → a 90-min capsule at 8:00 PM.
   - Tap a task's chip → ③ edit screen; ring on the header completes; Delete works.
   - ② ••• → Set Timezone → London on a 9:00 task → the timeline shows it in local time with the globe.
   - ③ sparkle on a real task → 3–7 steps → Keep all (this is plan-day v7's first live model call).
2. **Guarded re-check of the live build** (only if verify cannot run):
   `cd ~/Documents/code/optimo && git pull --ff-only && grep -c "segmentMaps" src/timeline/Timeline.tsx && curl -s https://schnubsy.github.io/optimo/ | grep -o '<meta name="build" content="[0-9a-f]*"'`
   — the grep count must be ≥ 1 and the build meta must equal the PR's merge SHA (it was `4f04493` before this arc).
