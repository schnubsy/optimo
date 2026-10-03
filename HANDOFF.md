# HANDOFF — optimo

## Current state
Arc 3 — **AI planner (Plan tab)** — is complete on `arc/ai-planner`: 16 slices ticked, gauntlet GREEN (vitest 340 ·
deno incl. plan-day · secret gates incl. no `sk-ant-` · Playwright desktop + iPhone 15 with axe · Lighthouse 100/100
desktop, 98/100 mobile), sentry GREEN, pre-PR page-diff GREEN. This HANDOFF is written before the PR. The close
continues in this session: PR → merge → reconcile main → Pages ship proof → launcher republish. Each of these is
recorded below once proven.

## Shipped this arc (on the branch)
1. Pages `paths-ignore` (docs/**, *.md, ARC.md, HANDOFF.md): control-file commits no longer deploy.
2–10. Snags #29–#37: iPhone inbox hint, brand-mark chip inside the pill, editor category flash, running pill over
   the now line, 44px parse chips, handshake glyph, Week header pad, Month gutter, toasts under sheets.
11. `planner_ai_plans` / `planner_ai_profile` in Dexie v3 + sync. Optional-table pushes park until 004 is live.
12. `plan-day` Edge Function (`propose` / `learn`): caller-JWT RLS, strict plan tool, web search ≤ 3 with sources,
   Haiku distil, 30/day, one retry, intent never logged, 503 `not_connected`.
13. Plan tab: intent / day / Propose|Auto / research → ghost blocks with a why each and clashes marked. Accept all /
   some / edit / reject; Auto + Undo; "Planner isn't connected yet" / offline states.
14. Learning on accept + Settings → Planning (default mode, research default, learned summary, Reset).
15. Eye LITE (`docs/evidence/ai-planner-slice-15-design-critique.md`): AI-P0-1 fixed (the Plan tab plans the app's
   day). 16 P1/P2 filed as `snag` #39–#54.
16. Lighthouse budget held (`…-slice-16-lighthouse-budget.md`). Sentry: `docs/evidence/ai-planner-sentry.md`.

## Open / blockers (close-out manifest)
- push · PR · merge · reconcile main checkout · Pages deploy + ship proof · launcher republish (#30 changed the
  brand mark the launcher carries): executed by this close session after this commit. The final report carries the
  proof for each.
- **migrations/backfills — BLOCKED → Mark's manual step 1** (Cowork applies `db/004_ai.sql`).
- **deploy (Edge Function plan-day) — BLOCKED → Mark's manual step 2** (Cowork deploys).
- Until steps 1 and 2 land, the Plan tab says "Planner isn't connected yet", AI outbox rows park, and core sync is unaffected.
- Snags #39–#54 (🟡/⚪) wait for the next train. #40 (Undo after Accept still teaches the profile) and #50 (re-plan
  with Auto selected writes the day) are the first to take.
- Carried: launcher heading font, iCloud connect and the on-device iPhone checks are not yet run by Mark.

## Exact next steps
1. Cowork: manual steps 1 → 2 below, then "Cowork: run verify".
2. Mark: step 3 (the real model on the Plan tab), then steps 4–6. Anything failing → a `snag` Issue.
3. Next arc: snag train for #39–#54 (any Claude Code prompt carries `MAIN CHECKOUT: /Users/mark/Documents/code/optimo`
   and `INBOX FILES:` as the order lists them, and pulls `main` before branching).

## Mark's manual steps
1. **Apply 004 (Cowork, Supabase connector, project `eepjhpyziczrxvirczio`).** Precondition, then the action, then
   the postcondition, in one chain:
   `cd ~/Documents/code/optimo && git pull --ff-only && [ "$(git hash-object db/004_ai.sql)" = 2e019b196e0546f76980550785af27f193b80fa1 ]`
   → apply `db/004_ai.sql` via the connector → run
   `select c.relname, c.relrowsecurity, (select count(*) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal) trg, (select count(*) from pg_policies p where p.tablename=c.relname) pol from pg_class c where c.relname in ('planner_ai_plans','planner_ai_profile');`
   **Postcondition:** both rows present, `relrowsecurity = true`, `trg = 2`, `pol = 1`.
2. **Deploy plan-day (Cowork/Mark, Terminal):**
   `cd ~/Documents/code/optimo && git pull --ff-only && grep -c handlePlan supabase/functions/plan-day/index.ts && supabase functions deploy plan-day --project-ref eepjhpyziczrxvirczio && curl -s -o /dev/null -w '%{http_code}\n' -X POST https://eepjhpyziczrxvirczio.supabase.co/functions/v1/plan-day`
   **Postcondition:** `grep -c` ≥ 1. The curl prints **401** (verify_jwt; unauthenticated). Record the new
   `ezbr_sha256` (no prior value: this is a new function). Then, signed in, Plan → Propose returns 200 and a
   `planner_ai_plans` row with `status = 'draft'` (`select status, model from planner_ai_plans order by id desc limit 1;`).
3. **Plan tab against the real model (Mark):** live app → Plan → write a real day → Propose. Check the blocks, each
   why, the challenge notes and ≤ 3 questions; Accept some → tasks on the timeline; Settings → Planning shows a
   learned summary after an accept. Research on → sources listed.
4. **Launcher font check (iPhone):** https://schnubsy.github.io/press/optimo.html. The heading should render in
   the rounded face.
5. **Connect iCloud:** appleid.apple.com → App-Specific Passwords → "+" `optimo` → live app → Settings → Calendars.
   Postcondition: "synced HH:MM" with calendars listed; `select count(*) from planner_events where deleted_at is null;` > 0.
6. **iPhone:** Add to Home Screen → open → Settings → Reminders → Turn on → Send a test. Postconditions: the test
   notification arrives; a task 10 min out with a 5-min reminder notifies with the app closed; the event sheet sits
   above the tab bar.
