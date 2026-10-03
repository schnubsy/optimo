## 2026-10-03 — Arc 5a: Family Wing sign-in · sync feedback · calendar roles · paint a block · people schema

Source: docs/backlog/2026-10-03-mark-feedback.md (B1–B5). Arc 4 Edge deploy is DONE (verify-2026-10-03-2.md).
Ratified decisions (Mark, 2026-10-03):
- B1: Family Wing is the only sign-in. Signed in → straight in; not signed in → Family Wing, then back. Member without optimo access → friendly "ask Mark" page + link to Family Wing. No optimo sign-in screen.
- B2: anyone signed in can add a person · everyone sees everyone in the picker · all data/config per person · today's data all → Mark · last-picked person remembered per device · each person links their own iCloud (Mark keeps today's link).
- B4: per calendar one role: Off · Show in optimo (read-only) · Two-way. Exactly one Two-way; replaces "Put optimo tasks in".
- Shape: B2 build needs a DDL apply only Cowork can run → arc 5a ships B1/B3/B4/B5 + the db/006 draft; arc 5b (people UI/sync/Edge) follows after Cowork applies db/006.
RULE: Family Wing 6-digit-code setup on `press` is not changed — optimo works within it.
RULE: db/006 is written, NOT applied, and must be additive + backward-compatible with the client this arc ships.

### Slice 1 — Family Wing is the only sign-in (B1) + leftover worktree
Status: done eda449d
Done: optimo reuses the marquee's supabase-js session (same origin, same project, same storage key — confirm by reading press/src); no session → redirect to the Family Wing sign-in with a return-to back to optimo; press_access_has('optimo') false → "ask Mark" page; src/auth OTP screen removed; `git worktree remove .claude/worktrees/agent-ab8537edaafdcce5a`. Playwright covers all three paths.

### Slice 2 — Sync button feedback (B5)
Status: open
Done: press → spinner + "Syncing…" (disabled) → "Synced · N events · N sent to iCloud" for a few seconds → or red reason + Retry. Same feedback on automatic syncs. calendar-sync returns the counts it needs.

### Slice 3 — One clear role per calendar (B4)
Status: open
Done: each calendar row shows Off · Show in optimo · Two-way with one-line helper text; exactly one Two-way (picking one demotes the old to Show); "Put optimo tasks in" select gone; maps onto calendars[].enabled + write_calendar_href (no DDL). Snag #56 (target-change side effects) and #58 (empty state) fixed here with `Fixes #n`.

### Slice 4 — Paint a block by dragging (B3)
Status: open
Done: press-drag on empty timeline (long-press on touch, never fights scroll) shows a grid-snapped ghost block; release creates the task; tap opens the detail editor. Keyboard path for a11y. 60 fps budget held (transforms only).

### Slice 5 — People schema draft (B2, not applied)
Status: open
Done: db/006_people.sql — planner_people + person_id on every per-person planner_* row (tasks, categories, settings, ai_profile, ai_plans, exceptions, calendar_accounts, links, events, push_subscriptions, reminder_sent, sync_log), backfill all rows to a "Mark" person, family-wide read/write via press_access_has('optimo'); additive and safe under the arc-5a client. docs/spec.md §People written (picker, per-device last person, per-person iCloud, sync scope). Arc 5b order drafted in HANDOFF.
