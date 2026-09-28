# HANDOFF — optimo

## Current state
v0.2 "Meadow" is LIVE end to end (2026-09-27): app on Pages at build `20d3c4c`, launcher `press/optimo.html`
published, and — as of this close-out — the server side is live too: secrets, the three Edge Functions, cron
(`planner_push_send` every minute, `planner_calendar_sync` every 15 min, both proven with a 200 from the function),
the Family Wing grant, and the council snag-registry row (`tenants-check: 46 pass, 0 fail`).
Gauntlet GREEN (320 unit · 142 Playwright desktop + iPhone 15 with axe · deno check/test · secret gate · Lighthouse
100/100, 98/100). Sentry GREEN (`docs/evidence/arc2-sentry.md`).

## Shipped this close-out (manual steps 1–5 of the arc-2 handoff)
1. Secrets: `supabase secrets set` from `.secrets/planner.env` → `secrets list` matched 5 names (Mark, Terminal).
2. Deploys: `calendar-connect`, `calendar-sync`, `push-send` via CLI (config.toml verify_jwt) → `functions list` = 3.
3. Cron: `vault.create_secret(…, 'planner_cron_secret')` + `db/003_cron.sql` (migration `optimo_003_cron`) →
   `cron.job` = 2; first push-send tick: `net._http_response` 200 `{"users":0,"sent":0,"pruned":0}` (Cowork connector).
4. Grant: `db/press/optimo_grant.sql` → `press_access_apps` row + 1 active grant for Mark (Cowork connector).
5. Registry: council `instruments/snag/registry.json` + optimo row, commit `cb3a209` pushed → tenants-check 0 fail.

## Open / blockers
- Step 6 (iCloud connect) and step 7 (iPhone on-device checks) not yet run by Mark — see below.
- This close-out commit is local only (Cowork's shell has no GitHub credentials): local `main` is 1 ahead of
  origin. The next Claude Code prompt pushes `main` first (same pattern as arc 2).
- 🟡 Design snags #15–#27 (incl. #26 brand mark too close to Structured's) → fold into arc 3's first slice.
- Environment manual (`~/Documents/Claude/claude-environment/MANUAL.md`) needs a Steward update: Deno installed
  (brew) for Edge Function checks; optimo listed in §1.1 but `manual.html` not regenerated.

## Exact next steps
1. Mark: steps 6–7 below; report what passes.
2. Arc-3 checkpoint — the AI planning layer (intent paragraphs → scheduled plan, challenge-style prompting) behind
   the reserved Plan tab (`RESERVED_AI_TAB` in `src/chrome/TabBar.tsx`), Anthropic via a Supabase Edge Function with
   the marquee-agent key. Take it to the Council ("convene the council"); fold #15–#27 into its first slice.
3. Steward: run the audit instrument to refresh MANUAL.md / manual.html (Deno, optimo, tenants).
Any Claude Code prompt for arc 3 carries `MAIN CHECKOUT: /Users/mark/Documents/code/optimo` and `INBOX FILES: none`,
and pushes `main` before branching.

## Mark's manual steps
6. **Connect iCloud:** appleid.apple.com → Sign-In and Security → App-Specific Passwords → "+" → name `optimo` → copy;
   live app → Settings → Calendars → Apple ID + that password → Connect.
   Postcondition: the account shows "synced HH:MM" with your calendars listed; today's events appear as outlined
   pills on the timeline; `select count(*) from planner_events where deleted_at is null;` > 0.
7. **iPhone:** Safari → live URL → Share → Add to Home Screen → open from the icon → Settings → Reminders → Turn on
   notifications → Send a test. Postconditions: the test notification appears; a task 10 min out with a 5-min
   reminder notifies with the app closed (`planner_reminder_sent` gains a row); timeline text under the tab bar is
   blurred; the quick-add sheet stays above the keyboard. Anything failing → a `snag` Issue for arc 3.
