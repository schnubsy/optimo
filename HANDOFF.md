# HANDOFF — optimo

## Current state
Arc 5a — **Family Wing sign-in · sync feedback · calendar roles · paint a block · people schema** is **merged and live**.
- **PR:** [schnubsy/optimo#80](https://github.com/schnubsy/optimo/pull/80), merged at `227d2d7` (2026-10-03). The main checkout is reconciled (HEAD = `227d2d7`).
- **Pages ship proof:** the live `<meta name="build">` changed `2727643` → **`227d2d7`**. The live bundle `assets/index-Bq6XwBfR.js` contains `press:family:v1`, "isn't switched on for you yet", "Sync again" and "Untitled block added".
- **Launcher published:** press `5334dd1`. The live https://schnubsy.github.io/press/optimo.html sha256 changed `82ddc9d2…` → **`90bd883b2d2dd58b6eb24a96d120d93faaa5bd92bb98e5185d7407e515fe9272`**, which equals release.js's dist hash. It carries the `?return=` bounce.
- #56 and #58 closed by the merge.
- **Gates:** gauntlet + sentry were GREEN; Eye LITE found no P0.
- **db/006 applied + Edge redeployed (manual steps 1–2): DONE 2026-10-03 by Code** — see `docs/evidence/arc5a-db006-apply.md`.

## Shipped this arc
1. **Family Wing is the only sign-in** (eda449d).
   - optimo reads and rotates the Family Wing session (`press:family:v1`) through a supabase-js storage adapter. The old optimo session migrates once.
   - Signed out → `press/optimo.html?return=<optimo URL>` → back.
   - `press_access_has('optimo.html')` false → the "ask Mark" page. No OTP screen.
   - Worktree `agent-ab8537edaafdcce5a` removed.
2. **Sync button feedback** (fbe6526): Syncing… / Synced · N events · N sent to iCloud / red reason + Retry, also during automatic syncs. calendar-sync returns `{events, pushed}`.
3. **One role per calendar** (ff78c31): Off · Show in optimo · Two-way, with exactly one Two-way. #56 and #58 fixed; the PR says `Fixes #56`, `Fixes #58`.
4. **Paint a block** (8545bfa): mouse drag, long-press-then-drag on touch, or keyboard (Enter / ↑↓ / Enter) → an untitled task; tap to edit. p95 frame 18 ms with 5k tasks.
5. **`db/006_people.sql`** (4c9a0d4), `git hash-object` = `d9261803e1f4f718b9d01a14dbdb1040c3a36a0d`. Scratch-proven 3× (39 PASS); **applied unchanged 2026-10-03** (migration `20261004003931`). Spec §5.3 / §5.4 People.

## Open / blockers (close-out manifest)
- **push · PR #80 · merge `227d2d7` · reconcile main (HEAD = `227d2d7`) · Pages ship proof (`2727643` → `227d2d7`): DONE.**
- **publish (press launcher): DONE.** press `5334dd1`; the live sha256 equals the dist sha256 `90bd883b…` (was `82ddc9d2…`).
- **migrations: DONE.** db/006 applied by Code via the Supabase connector (`optimo_006_people`, `20261004003931`). Mark = 1 person, 0 unassigned rows, `family_access` = false, max(version) is still 9. One new advisor WARN, by design: `planner_family_access()` is callable by authenticated.
- **deploy (Edge: calendar-sync, calendar-connect): DONE.** Both moved v3 → v4. calendar-sync ezbr `4fa36d95…` → `3ee448f2…`; calendar-connect `b3532d49…` → `27d97ea7…`. Read-back is byte-identical to the repo (10/10 files each). The 00:45 UTC cron sync answered `200 {…,"events":12,"pushed":0}`.
- **Inbox cleanup: N/A.** The main checkout is not a worktree. The three inbox files (ARC.md, the feedback backlog, verify-2026-10-03-2) were committed in slice 1, so no uncommitted copies remain.
- **Agent worktrees left in place** (worktrees are never removed inside an order; all three commits are merged): `.claude/worktrees/agent-a370c47dae060ce82`, `agent-ab7dd340f3765ec38`, `agent-a07ccb21bbff20c5d`.
- **Snags:** #67–#79 (Eye 5a: P1 #79, #67–#70; P2 #71–#78), plus #57, #59–#65 and #39–#54 carried.

## Exact next steps
1. Cowork: "Cowork: run verify" (manual steps 1–2 are DONE).
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
1. **DONE 2026-10-03 (Code)** — proof: `docs/evidence/arc5a-db006-apply.md`. ~~Apply db/006 (Supabase connector, project `eepjhpyziczrxvirczio`).~~
   - **Precondition:** `cd ~/Documents/code/optimo && git pull --ff-only && test "$(git hash-object db/006_people.sql)" = d9261803e1f4f718b9d01a14dbdb1040c3a36a0d`, and note `select max(version) from planner_tasks;`.
   - **Action:** apply `db/006_people.sql` unchanged.
   - **Postcondition** (the queries at the foot of the file):
     - `planner_people` has Mark, with `created_by` not null;
     - every `person_id is null` count is 0 for Mark's rows;
     - `planner_flags.family_access = false`;
     - `max(version)` is unchanged;
     - advisors show no new RLS / anon-definer findings;
     - optimo still opens and syncs.
2. **DONE 2026-10-03 (Code)** — calendar-sync v4 `3ee448f2…`, calendar-connect v4 `27d97ea7…`, read-back matches the repo, and the cron sync returns top-level `events` + `pushed`. ~~Deploy calendar-sync + calendar-connect.~~
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
