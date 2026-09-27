# HANDOFF — optimo

## Current state
v0.2 "Meadow" (arc 2, 2026-09-27, branch `arc/v0-2-meadow`). FINAL pastel design, floating chrome, in-repo glyphs +
auto-suggest, snags #1–#12 + resize persistence. iCloud calendar (read-only) and web push are built and tested
end to end against hermetic fakes; they are **inert on the live site until steps 1–4 below run**. Gauntlet GREEN
(320 unit · 142 Playwright desktop + iPhone 15 with axe · deno check/test · secret gate · Lighthouse 100/100, 98/100).
Sentry GREEN (`docs/evidence/arc2-sentry.md`).

## Shipped this arc (evidence: `docs/evidence/arc2-slice-*`)
1. 69490d3 snags #1–#12; resize commits the release-point duration (quick-flick bug), 44px band, Shift+↑/↓ ±5.
2. e65753c tokens.css verbatim + `tokens-a11y.css` (measured), pills, chip = complete control, free-time rule, sweep.
3. 48b9eda header fade + tab bar + FAB + segmented; 64+12 glyphs (`src/icons/set.ts`); `src/quickadd/suggest.ts`.
4. 7ce7f62 calendar-connect / calendar-sync (+ `_shared` handlers), Settings → Calendars, event pills, `scripts/secrets.mjs`.
5. 4ab0ef6 `src/sw.ts` push, Settings → Reminders, push-send, `scripts/vapid.mjs`, `db/003_cron.sql` (not applied).
6. d71fe04 press launcher `optimo.html` (build-press.mjs, tools/release.js), `db/press/optimo_grant.sql`; press branch
   `arc/optimo-card` (3d7d410: spaces family + tenants.json + ARC pointer). Brand mark redrawn.
7. 3158271 Eye LITE: 4 P0 fixed + guarded (`tests/review2.spec.ts`), 13 P1 → schnubsy/optimo#15–#27; perf with events.

## Open / blockers
- Close-out (this arc): push · PR · merge · reconcile main checkout · Pages deploy (ship proof: live
  `<meta name="build">` == merge SHA) · press publish (release.js → press/optimo.html + pages.json, 200 + blob SHA;
  press branch merged + deleted) · inbox cleanup — run by Code at close; proof in the arc-close report.
- Migrations: db/002 DONE (pre-applied, verified 2026-09-27). db/003 + optimo_grant → steps 3–4.
- Edge Functions calendar-connect / calendar-sync / push-send: not on press (pre-deploy state: absent) → step 2.
- tenants-check T8 (optimo.html): needs a council snag-registry row → step 5 (T1 clears when release.js runs).
- Tab-bar blur and keyboard-avoiding quick-add verified in Chromium / by geometry, not on a device → step 7.

## Exact next steps
1. Mark runs the manual steps below, then signs in on the live URL and uses v0.2 for real.
2. Arc-3 checkpoint: the AI planning layer (intent → plan), behind the reserved Plan tab (`RESERVED_AI_TAB` in
   `src/chrome/TabBar.tsx`). Take it to the Council ("convene the council"); fold the #15–#27 snags into its first slice.
Any Claude Code prompt for arc 3 carries `MAIN CHECKOUT: /Users/mark/Documents/code/optimo` and `INBOX FILES: none`.

## Mark's manual steps (each: precondition && action && postcondition)
1. **Edge Function secrets** (5 names, values only in the gitignored `.secrets/planner.env` on this Mac):
   `cd /Users/mark/Documents/code/optimo && git pull --ff-only && grep -c VAPID_PRIVATE_KEY .secrets/planner.env && supabase secrets set --project-ref eepjhpyziczrxvirczio --env-file .secrets/planner.env && supabase secrets list --project-ref eepjhpyziczrxvirczio | grep -cE 'PLANNER_KEK|CRON_SECRET|VAPID_PUBLIC_KEY|VAPID_PRIVATE_KEY|VAPID_SUBJECT'`
   Precondition prints `1` (a `0` = wrong checkout, STOP). Expected postcondition: `5`.
2. **Deploy the three functions** (Mark / Cowork):
   `cd /Users/mark/Documents/code/optimo && git pull --ff-only && grep -c handlePushSend supabase/functions/push-send/index.ts && for f in calendar-connect calendar-sync push-send; do supabase functions deploy $f --project-ref eepjhpyziczrxvirczio || exit 1; done && supabase functions list --project-ref eepjhpyziczrxvirczio | grep -cE 'calendar-connect|calendar-sync|push-send'`
   Precondition `1`. Postcondition `3`; each function's `ezbr_sha256` must now EXIST (pre-deploy: the slugs were
   absent) — record the three hashes; any later redeploy must change them.
3. **Cron** (Cowork's Supabase connector, after 1–2): `select vault.create_secret('<CRON_SECRET from .secrets/planner.env>', 'planner_cron_secret');`
   then apply `db/003_cron.sql` (it refuses without the vault secret). Postcondition:
   `select count(*) from cron.job where jobname in ('planner_push_send','planner_calendar_sync');` → `2`.
4. **Family Wing grant** (Cowork): apply `db/press/optimo_grant.sql`. Postcondition (T6):
   `select count(*) from press_access_grants where page='optimo.html' and active;` → `1`.
5. **Council snag registry row** (tenants-check T8):
   `cd ~/Documents/Claude/council-hub/council && git pull --ff-only && grep -c '"remit.html"' instruments/snag/registry.json && node -e "const f='instruments/snag/registry.json',d=JSON.parse(require('fs').readFileSync(f));if(!d.solutions.some(r=>r.page==='optimo.html'))d.solutions.push({id:'optimo',name:'optimo',kind:'web',repo:'schnubsy/optimo',page:'optimo.html',tier:'family',labels:['snag'],release:'tools/release.js',aliases:['planner','day planner','timeline','optimo'],notes:'Day-planner PWA; optimo.html is its Family Wing launcher card.'});require('fs').writeFileSync(f,JSON.stringify(d,null,2)+'\n')" && git add instruments/snag/registry.json && git commit -m "snag registry: optimo.html" && git push && cd ~/Documents/code/press && node tools/tenants-check.mjs | tail -1`
   Precondition `1`. Expected postcondition: `tenants-check: … 0 fail …`.
6. **Connect iCloud** (after 1–2): appleid.apple.com → App-Specific Passwords → create "optimo"; live app →
   Settings → Calendars → Apple ID + that password → Connect. Postcondition: the account shows "synced HH:MM" with
   your calendars listed, and today's events appear as outlined pills on the timeline.
7. **iPhone check** (after 1–3): Share → Add to Home Screen → open optimo from the icon → Settings → Reminders →
   Turn on notifications → Send a test. Postconditions: the test notification appears; a task with a 5-min reminder
   notifies ~5 min before its start with the app closed; timeline text under the tab bar is blurred; the quick-add
   sheet stays above the keyboard.
