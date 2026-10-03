# HANDOFF — optimo

## Current state
v0.2 "Meadow" + **snag train 2026-10** are LIVE: PR #38 merged `e17b434` (2026-10-02), Pages build `e17b434`
(ship-proofed), launcher `press/optimo.html` republished (press `0657e99`; live = local = GitHub blob
`bc8be8c6…1785`), Issues #15–#27 closed, council registry run record `published` (council `87f8011`,
`shadow_remaining` 3). Gauntlet GREEN (unit · Playwright desktop + iPhone 15 with axe · deno · secret gate ·
Lighthouse 100/100 desktop, 98/100 mobile).

## Shipped this arc (merged + live)
1–13. #15 now-pill masks the hour · #16 week/timeline glyphs · #17 four activity glyphs · #18 `ui-calendar` + calendar
   ring · #19 iPhone event sheet · #20 settings labels → h3 · #21 settings scroll pad · #22 week snap/pad · #23 44px parse
   chips · #24 post-chrome evidence · #25 launcher rounded heading + dark · #26 brand mark on a blush ground · #27 flat sweep.
14. Eye LITE (`docs/evidence/snag-train-2026-10-slice-14-design-critique.md`): 2 P0 fixed (event sheet portalled above
   the tab bar; Reminders/Calendars legends → h3); 9 P1/P2 filed as `snag` #29–#37. Brand mark: no originality concern
   left vs Structured; a faint toggle-knob read remains → #30.
15. Lighthouse budget (`…-slice-15-lighthouse-budget.md`): 100/100 · 98/100 — identical to arc 2.
PRE-PR page-diff (`…-pre-pr-page-diff.md`): untouched views (Inbox, Month) ≤ 0.08% vs live; touched views pre-justified.

## Open / blockers
- Merge, Pages ship proof and launcher republish: DONE 2026-10-02 (see Current state).
- This HANDOFF update is a local commit on `main` (a docs-only push would re-deploy Pages and move the build SHA
  off `e17b434`); the next arc's first push carries it. 🟡 Add `paths-ignore` for docs/control files to
  `.github/workflows/pages.yml` in arc 3 so control-file commits stop triggering deploys.
- Launcher heading's rounded face is unverified on a real device (headless engines fall back to the system font).
- Carried from arc 2: iCloud connect (step 3) and iPhone on-device checks (step 4) not yet run by Mark.
- New snags #29–#37 (🟡) wait for the next train or arc 3's first slice.

## Exact next steps
1. Mark: steps 1–3 below; anything failing → a `snag` Issue.
3. Arc-3 checkpoint — AI planning layer behind the reserved Plan tab (`RESERVED_AI_TAB` in `src/chrome/TabBar.tsx`).
   Take it to the Council ("convene the council"). Any Claude Code prompt for it carries
   `MAIN CHECKOUT: /Users/mark/Documents/code/optimo` and `INBOX FILES: none`, and pulls `main` before branching.

## Mark's manual steps
1. **Launcher font check (iPhone):** open https://schnubsy.github.io/press/optimo.html on the phone — the heading
   should render in the rounded face (headless browsers fell back to the system font, so this is unverified).
2. **Connect iCloud:** appleid.apple.com → Sign-In and Security → App-Specific Passwords → "+" → name `optimo` → copy;
   live app → Settings → Calendars → Apple ID + that password → Connect.
   Postcondition: "synced HH:MM" with calendars listed; today's events show as outlined pills;
   `select count(*) from planner_events where deleted_at is null;` > 0.
3. **iPhone:** Safari → live URL → Share → Add to Home Screen → open from the icon → Settings → Reminders → Turn on
   notifications → Send a test. Postconditions: the test notification appears; a task 10 min out with a 5-min reminder
   notifies with the app closed (`planner_reminder_sent` gains a row); the event-details sheet sits above the tab bar.
