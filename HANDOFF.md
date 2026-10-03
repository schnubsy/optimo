# HANDOFF — optimo

## Current state
v0.2 "Meadow" is LIVE (Pages build `636a4ce`; server side live since 2026-09-27). The **snag train 2026-10** (shadow
mode) is complete on `arc/snag-train-2026-10`: all 13 design snags (#15–#27) fixed, Eye LITE review run, Lighthouse
at baseline, page-diff gate green. The PR into `main` is **open, not merged** — merging is Mark's call (it triggers
the Pages deploy). Gauntlet GREEN on the branch (unit · Playwright desktop + iPhone 15 with axe · deno · secret gate ·
Lighthouse 100/100 desktop, 98/100 mobile).

## Shipped this arc (on the branch — not live until merged)
1–13. #15 now-pill masks the hour · #16 week/timeline glyphs · #17 four activity glyphs · #18 `ui-calendar` + calendar
   ring · #19 iPhone event sheet · #20 settings labels → h3 · #21 settings scroll pad · #22 week snap/pad · #23 44px parse
   chips · #24 post-chrome evidence · #25 launcher rounded heading + dark · #26 brand mark on a blush ground · #27 flat sweep.
14. Eye LITE (`docs/evidence/snag-train-2026-10-slice-14-design-critique.md`): 2 P0 fixed (event sheet portalled above
   the tab bar; Reminders/Calendars legends → h3); 9 P1/P2 filed as `snag` #29–#37. Brand mark: no originality concern
   left vs Structured; a faint toggle-knob read remains → #30.
15. Lighthouse budget (`…-slice-15-lighthouse-budget.md`): 100/100 · 98/100 — identical to arc 2.
PRE-PR page-diff (`…-pre-pr-page-diff.md`): untouched views (Inbox, Month) ≤ 0.08% vs live; touched views pre-justified.

## Open / blockers
- PR from `arc/snag-train-2026-10` awaits Mark's merge (shadow mode — the train never merges).
- After merge: Pages ship proof (step 1) and the press launcher republish (step 2) are owed — the live launcher
  still shows the pre-#26 brand mark until step 2 runs.
- Launcher heading's rounded face is unverified on a real device (headless engines fall back to the system font).
- Carried from arc 2: iCloud connect (step 3) and iPhone on-device checks (step 4) not yet run by Mark.
- New snags #29–#37 (🟡) wait for the next train or arc 3's first slice.

## Exact next steps
1. Mark: review + merge the PR, then steps 1–2 below.
2. Mark: steps 3–4 below; anything failing → a `snag` Issue.
3. Arc-3 checkpoint — AI planning layer behind the reserved Plan tab (`RESERVED_AI_TAB` in `src/chrome/TabBar.tsx`).
   Take it to the Council ("convene the council"). Any Claude Code prompt for it carries
   `MAIN CHECKOUT: /Users/mark/Documents/code/optimo` and `INBOX FILES: none`, and pulls `main` before branching.

## Mark's manual steps
1. **Pages ship proof (after merge).** Expected: `SHIPPED <sha>` where `<sha>` is the merge commit; a mismatch = not shipped.
   ```
   cd ~/Documents/code/optimo && git checkout main && git pull && grep -c createPortal src/timeline/EventBlock.tsx && gh run watch "$(gh run list -w pages.yml -L1 --json databaseId -q '.[0].databaseId')" && [ "$(curl -s https://schnubsy.github.io/optimo/ | sed -n 's/.*name="build" content="\([0-9a-f]*\)".*/\1/p')" = "$(git rev-parse --short HEAD)" ] && echo "SHIPPED $(git rev-parse --short HEAD)"
   ```
   (`grep -c` must print ≥ 1 — 0 means `main` lacks this arc: STOP.)
2. **Republish the press launcher (after step 1).** Expected: `SHIPPED` — the live page's sha256 equals `dist/optimo.html`'s.
   ```
   cd ~/Documents/code/optimo && git pull && grep -c 'fill="#fff4f2"' src/icons/brand.svg && npm run release:press && cd ../press && git add optimo.html pages.json && git commit -m "publish optimo.html — snag train 2026-10" && git push && sleep 90 && [ "$(curl -s https://schnubsy.github.io/press/optimo.html | shasum -a 256 | cut -d' ' -f1)" = "$(shasum -a 256 ../optimo/dist/optimo.html | cut -d' ' -f1)" ] && echo SHIPPED
   ```
   Then on iPhone: open the launcher card — the heading should be the rounded face.
3. **Connect iCloud:** appleid.apple.com → Sign-In and Security → App-Specific Passwords → "+" → name `optimo` → copy;
   live app → Settings → Calendars → Apple ID + that password → Connect.
   Postcondition: "synced HH:MM" with calendars listed; today's events show as outlined pills;
   `select count(*) from planner_events where deleted_at is null;` > 0.
4. **iPhone:** Safari → live URL → Share → Add to Home Screen → open from the icon → Settings → Reminders → Turn on
   notifications → Send a test. Postconditions: the test notification appears; a task 10 min out with a 5-min reminder
   notifies with the app closed (`planner_reminder_sent` gains a row); the event-details sheet sits above the tab bar.
