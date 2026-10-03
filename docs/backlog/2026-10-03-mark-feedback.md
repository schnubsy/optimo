# Backlog — Mark's feedback 2026-10-03 (captured by Cowork; seed for arc 5)

## Cowork close-out 2026-10-03 (read first in the arc-5 kickoff)
- Arc 4 HANDOFF "Mark's manual steps" step 1 (Edge deploy) is DONE by Cowork: calendar-sync v2 ezbr 4fa36d95…, calendar-connect
  v2 ezbr b3532d49…, byte-exact vs repo; live sync = 4 calendars (Mark, Optimo, Family, Barb), 19 events, write target Optimo,
  13 tasks linked, a second sync pushed 0 (no ping-pong). iCloud→optimo edit not yet exercised live (Mark to try).
- Uncommitted INBOX FILES for the arc-5 order: this file, docs/evidence/verify-2026-10-03-2.md (verify-2026-10-03.md was
  committed in arc 4).
- Leftover sub-agent worktree .claude/worktrees/agent-ab8537edaafdcce5a (merged) — remove in arc 5 (`git worktree remove`).
- Arc-5 scope = B1–B5 below. Snags open: #39–#54 (arc 3; #40, #50 first), #56–#65 (arc 4).

The arc-5 kickoff turns this into an ARC.md block (+ INBOX FILES line).

## B1 — Family Wing is the only sign-in (no separate optimo login)
Ask: signed in on Family Wing → straight into optimo. Not signed in → sent to Family Wing to sign in, then back. No optimo sign-in screen.
Constraint (standing, Mark): the Family Wing 6-digit-code setup on `press` is not changed; apps work within it.
Cowork note (inferred, to confirm in arc 5): optimo (schnubsy.github.io/optimo/) and the marquee (schnubsy.github.io/press/)
share ONE browser origin and ONE Supabase project, so optimo can likely reuse the Family Wing session directly
(same supabase-js storage key) — no new auth server work. Today optimo runs its own OTP flow (`src/auth/session.ts`).
Needs: return-to URL after Family Wing sign-in; a gate check against the Family Wing access model (`press_access_has('optimo')`).

## B2 — People in optimo (no extra security)
Ask: add a person to optimo and pick who you are from a list. Everyone sees everyone in the picker. ALL data and config is per person
(tasks, categories, settings, calendars, AI profile, reminders).
Design note: a `planner_people` table + `person_id` on every planner_* row; the picker sets the active person; sync/RLS scope by
person within the signed-in family. Open decisions for the arc-5 batch: who can add people; is the last-picked person
remembered per device; what happens to today's data (assign to Mark).

## B3 — Paint a block by dragging on the timeline
Ask: press on an empty part of the day and drag down → an empty block appears over exactly that span (snapped to the grid);
release → it's created; tap it → the detail editor opens to fill in title, category etc.
Notes: must not fight scroll on iPhone (long-press to start painting, like the existing drag); keyboard alternative for a11y.

## B4 — Make each calendar's role obvious (Mark, after arc 4 went live)
Today: the switch per calendar = show its events in optimo (read-only); optimo writes ONLY to the one "Put optimo tasks in"
calendar (currently "Optimo"). Works, but the screen doesn't say so.
Ask: each calendar shows one clear role — **Off · Show in optimo (read-only) · Two-way (optimo tasks sync here)**. Exactly one
calendar can be Two-way; picking it replaces the separate "Put optimo tasks in" select. Helper text says what each role does.

## B5 — Sync button feedback
Today: a white oval that doesn't change when pressed; only the "synced HH:MM" line moves.
Ask: pressed → spinner + "Syncing…" (button disabled); done → "Synced · N events · N sent to iCloud" for a few seconds;
failed → red message with the reason and Retry. Same feedback when an automatic sync runs.
