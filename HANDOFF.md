# HANDOFF — optimo

## Current state
Arc 4 — **iCloud two-way sync + calendar picker** is **merged and live on Pages**: PR #66 merged at `2727643`
(2026-10-03). Main checkout reconciled (HEAD = `2727643`). Pages ship proof: live `<meta name="build">` = **`2727643`**
(was `10866d1`), and the live bundle `assets/index-B2s7eOzV.js` contains "Put optimo tasks in", "No calendars found"
and the new helper copy. Gauntlet + sentry were GREEN (Lighthouse 100/100 · 98/100). **The live Edge Functions are
still the arc-2 v1 code** (read-only; the discovery bug that found 0 calendars) until Cowork runs manual step 1 — until
then the new picker shows whatever the old function stored.

## Shipped this arc (on the branch)
1. Discovery reads `name='VEVENT'` and `name="VEVENT"` alike; calendars carry `shared` / `writable`. Every CalDAV
   fixture is now iCloud-shaped; the regression test fails on the old code (`…-slice-1-discovery.md`).
2. Rediscovery every sync (toggles kept, new calendars on, vanished ones gone); default write target = a calendar named
   "optimo" the first time it is found (Mark's existing empty account heals and picks it on its first sync). Status:
   "Found N calendars · synced HH:MM · N events" / "No calendars found on this Apple ID".
3. Settings → Calendars picker: colour dot, name, "Shared" badge, read switch, "Put optimo tasks in" (None or writable).
4. Push: scheduled, non-recurring tasks from now−7 d onward → `optimo-<id>.ics` in the chosen calendar (all-day as
   DATE); edits re-PUT with If-Match; delete / unschedule → DELETE; new target → move; completed tasks stay. The app
   asks calendar-sync ~5 s after pushing task changes; the 15-min cron is the backstop. Recurring tasks: not written.
5. Pull back: iCloud move / rename → the task; deleted in iCloud → task tombstoned; 412 → iCloud wins; no ping-pong.
6. Eye LITE: no P0; P1-1 helper copy corrected in-arc; #56–#65 filed as `snag`. 7. Lighthouse budget held.
Also: Plan specs' time-of-day failure fixed (fake server clock follows the pinned page clock); eslint ignores `.claude/`.

## Open / blockers (close-out manifest)
- push · PR #66 · merge `2727643` · reconcile main (HEAD = `2727643`) · Pages ship proof (build `10866d1` → `2727643`):
  **DONE**, proofs in Current state. Inbox cleanup: none needed — ARC.md, db/005 and the arc-3 verify doc lived in the
  main checkout (no worktree) and are now tracked (db/005 `455dd4ce…` unchanged; ARC.md truncated by the close).
- The slice-3 sub-agent's worktree `.claude/worktrees/agent-ab8537edaafdcce5a` (branch `worktree-agent-ab8537edaafdcce5a`,
  its commit c0bd968 is merged) was left in place — worktrees are never removed inside an order; remove it at will.
- **migrations — DONE by Cowork** before the order: `db/005_calendar_twoway.sql` applied, committed unchanged
  (`git hash-object` = `455dd4ce41f2af0561bc3d69602e030d5ce98011`).
- **deploy (Edge: calendar-connect, calendar-sync) — BLOCKED → manual step 1 (Cowork).**
- publish (press launcher) — N/A: the launcher card is unchanged this arc.
- Snags #56–#65 (🟡/⚪) wait for the next train; #56 (target-change side effects) and #58 (empty state) first.
  Carried: #39–#54 from arc 3.
- Uncommitted on purpose in the main checkout: `docs/backlog/2026-10-03-mark-feedback.md` (Cowork's arc-5 seed).

## Exact next steps
1. Cowork: manual step 1, then "Cowork: run verify".
2. Mark: steps 2–3 (real Apple ID, real iPhone). Anything failing → a `snag` Issue.
3. Next arc: arc 5 from `docs/backlog/2026-10-03-mark-feedback.md` (any Claude Code prompt carries
   `MAIN CHECKOUT: /Users/mark/Documents/code/optimo` and `INBOX FILES:` as the order lists them, and pulls `main`
   before branching).

## Mark's manual steps
1. **Deploy calendar-connect + calendar-sync (Cowork, Supabase connector, project `eepjhpyziczrxvirczio`).**
   Precondition → action → postcondition, in one chain:
   `cd ~/Documents/code/optimo && git pull --ff-only && grep -c "twoWay(dav, acc, p" supabase/functions/_shared/handlers.ts`
   (must print ≥ 1) → deploy both functions via the connector with their entry `calendar-*/index.ts` plus
   `deno.json` and `_shared/{caldav,crypto,due,handlers,ics,supabase,twoway,vevent}.ts`; keep `verify_jwt` as today
   (calendar-connect **true**, calendar-sync **false** — it also takes `x-cron-secret`) → list the functions.
   **Postcondition:** `ezbr_sha256` differs from the pre-deploy values — calendar-connect
   `9c67cfe5b8206a0e4155bb4600568e43584ef31222bc4b067ebc8dcf4e5cd5d8`, calendar-sync
   `be3d852f7b4d5025e55a9f733873bf2834602b6c1495d8e6e53c8a143464364d` (both v1) — and the source read back matches
   the repo. Then, signed in as Mark: Settings → Calendars → Sync now shows **"Found N calendars" with N ≥ 1**;
   `select count(*) from planner_events where deleted_at is null;` **> 0**; `select write_calendar_href from
   planner_calendar_accounts;` ends in the "optimo" calendar's href; create a test task today 15:00 in optimo → within
   ~10 s it appears in that iCloud calendar (`select count(*) from planner_calendar_links;` ≥ 1), then delete it.
   Note: on that first sync every scheduled task from 7 days ago onward is written into the "optimo" calendar.
2. **Two-way on the real Apple ID (Mark).** iPhone Calendar: move an optimo task's event → Sync now in optimo → the task
   moves; rename → the title follows; delete → the task disappears. Settings → Calendars: switch a calendar off → its
   events leave the timeline; pick "None" → new tasks stop appearing in iCloud.
3. **iPhone:** Add to Home Screen → open → Settings → Reminders → Turn on → Send a test (carried from arc 2/3); the
   launcher heading renders in the rounded face at https://schnubsy.github.io/press/optimo.html.
