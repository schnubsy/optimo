# HANDOFF — optimo

## Current state
Arc 5a — **Family Wing sign-in · sync feedback · calendar roles · paint a block · people schema** is complete on
`arc/family-wing-people`. Gauntlet + sentry are GREEN (Lighthouse 100/100 · 98/100); Eye LITE found no P0. The PR, merge,
reconcile, Pages ship proof and launcher publish run now as this order's close. Their proofs are recorded in the
post-merge HANDOFF commit on `main`.

## Shipped this arc
1. **Family Wing is the only sign-in** (eda449d).
   - optimo reads and rotates the Family Wing session (`press:family:v1`) through a supabase-js storage adapter. The old optimo session migrates once.
   - Signed out → `press/optimo.html?return=<optimo URL>` → back.
   - `press_access_has('optimo.html')` false → the "ask Mark" page. No OTP screen.
   - Worktree `agent-ab8537edaafdcce5a` removed.
2. **Sync button feedback** (fbe6526): Syncing… / Synced · N events · N sent to iCloud / red reason + Retry, also during automatic syncs. calendar-sync returns `{events, pushed}`.
3. **One role per calendar** (ff78c31): Off · Show in optimo · Two-way, with exactly one Two-way. #56 and #58 fixed; the PR says `Fixes #56`, `Fixes #58`.
4. **Paint a block** (8545bfa): mouse drag, long-press-then-drag on touch, or keyboard (Enter / ↑↓ / Enter) → an untitled task; tap to edit. p95 frame 18 ms with 5k tasks.
5. **`db/006_people.sql`** (4c9a0d4), written but NOT applied (`git hash-object` = `d9261803e1f4f718b9d01a14dbdb1040c3a36a0d`). Scratch-proven 3× (39 PASS). Spec §5.3 / §5.4 People.

## Open / blockers (close-out manifest)
- **push · PR · merge · reconcile main · Pages ship proof:** run in this close; the proofs go in the post-merge HANDOFF commit.
- **publish (press launcher):** the card changed (`?return=` bounce), so release.js publishes it after merge + reconcile. Launcher ship proof (sha256 of press/optimo.html == dist) goes in the same post-merge commit.
- **migrations — BLOCKED → manual step 1 (Cowork applies db/006).** Until then, nothing in 5a depends on it.
- **deploy (Edge: calendar-sync, calendar-connect) — BLOCKED → manual step 2.**
  - Until it's deployed, the live function returns no top-level counts. The client sums `accounts[]` instead, so the button still reads "Synced · N events · N sent to iCloud".
- **Inbox cleanup:** none needed. The main checkout is not a worktree, and the three inbox files were committed in slice 1.
- **Agent worktrees left in place** (worktrees are never removed inside an order; all three commits are merged): `.claude/worktrees/agent-a370c47dae060ce82`, `agent-ab7dd340f3765ec38`, `agent-a07ccb21bbff20c5d`.
- **Snags:** #67–#79 (Eye 5a: P1 #79, #67–#70; P2 #71–#78), plus #57, #59–#65 and #39–#54 carried.

## Exact next steps
1. Cowork: manual steps 1–2, then "Cowork: run verify".
2. Mark: steps 3–4 on real devices. Anything failing → a `snag` Issue.
3. **Arc 5b — people** (after step 1). Any Claude Code prompt carries `MAIN CHECKOUT: /Users/mark/Documents/code/optimo` + `INBOX FILES:` and pulls `main` before branching. Slices:
   - **(a) People picker.** List + "Add someone" (name, colour). The last pick is remembered per device (`optimo.person`); the picker is skipped with one person; a switcher sits in the header.
   - **(b) Per-person sync.**
     - Outbox rows carry `person_id`.
     - Pull and realtime are filtered by `person_id` + `user_id`, with a cursor per person per device.
     - Settings / ai_profile upsert `on_conflict=person_id`.
     - Calendar accounts are listed per person.
     - Then a guarded Cowork step flips `planner_flags.family_access = true`.
   - **(c) Per-person iCloud in Edge.** calendar-connect / calendar-sync take the person from the request; the cron path iterates by person; events and links carry the account's person. Then a Cowork deploy.
   - **(d) Snags first:** #79, #67–#70.

## Mark's manual steps
1. **Apply db/006 (Cowork, Supabase connector, project `eepjhpyziczrxvirczio`).**
   - **Precondition:** `cd ~/Documents/code/optimo && git pull --ff-only && test "$(git hash-object db/006_people.sql)" = d9261803e1f4f718b9d01a14dbdb1040c3a36a0d`, and note `select max(version) from planner_tasks;`.
   - **Action:** apply `db/006_people.sql` unchanged.
   - **Postcondition** (the queries at the foot of the file):
     - `planner_people` has Mark, with `created_by` not null;
     - every `person_id is null` count is 0 for Mark's rows;
     - `planner_flags.family_access = false`;
     - `max(version)` is unchanged;
     - advisors show no new RLS / anon-definer findings;
     - optimo still opens and syncs.
2. **Deploy calendar-sync + calendar-connect (Cowork).**
   - **Precondition:** `cd ~/Documents/code/optimo && git pull --ff-only && grep -c "accounts: results, events, pushed" supabase/functions/_shared/handlers.ts` (must print 1).
   - **Action:** deploy both functions with their entry `calendar-*/index.ts` plus `deno.json` and `_shared/{caldav,crypto,due,handlers,ics,supabase,twoway,vevent}.ts`. Keep `verify_jwt` (connect **true**, sync **false**).
   - **Postcondition:**
     - `ezbr_sha256` differs from the pre-deploy values: calendar-sync `4fa36d951fd1e4bc19f39c14b4f8b537d9418808dc0782031405f1e9b50d479b`, calendar-connect `b3532d49665747cd74112ebd5f3b4e72cfc7e92a0db15411b3c02e4c2de649de` (both v2).
     - The read-back source matches the repo.
     - A manual sync answers JSON with top-level `events` and `pushed`.
3. **Family Wing sign-in (Mark, iPhone + Mac).** Open https://schnubsy.github.io/optimo/ in a private window → lands on the Family Wing sign-in → 6-digit code → back in optimo on the same URL. Signed-in elsewhere → straight in. Settings → "Sign out of the Family Wing" → the Family Wing door also shows signed out.
4. **On-device checks (Mark, iPhone).**
   - Long-press empty timeline, then drag → a block with live times; release → untitled block; tap → editor. A quick swipe just scrolls.
   - Settings → Calendars: Sync now shows Syncing… → Synced · N events · N sent to iCloud; roles switch with one Two-way.
   - Carried from arc 4: two-way edits on the real Apple ID; Reminders test push.
