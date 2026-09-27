## 2026-09-27 — Arc 2: look & feel, calendar, reminders, wing card (checkpoint decisions + work order)

DECISIONS (ratified 2026-09-27 by Mark):
- **Design = the FINAL blend** in `docs/design/2026-09-27-final/` (final.html · tokens.css · spec.md ·
  design-system-prompt.md): Meadow base, Nunito Sans, pastel pills r22 with a left glyph chip that IS the
  complete control (checkbox removed), dotted free-time rule with the Meadow pill label, elapsed sweep,
  floating pill tab bar + separate FAB on iPhone with the timeline scrolling beneath, blended header fade,
  desktop keeps the inbox rail + floating Day/Week/Month segmented pill. Switchboard is retired.
  Research digests: `docs/design/2026-09-27-research/`. Full review pack: `docs/design/2026-09-27-full/`.
- **Calendar = iCloud (CalDAV), read-only** events on the timeline. Google deferred.
- **Web push reminders = yes** (installed-PWA on iPhone).
- **Family-wing card = yes**: a press launcher page `optimo.html` in the FAMILY space that opens the app.
- **Fold snags #1–#12 in** + 🔴 the resize-by-edge bug (visual only; must persist `duration_min`).
- `db/002_calendar_push.sql` is ALREADY APPLIED to press (verified 2026-09-27: 4 tables, 4 policies,
  `secret_enc` not selectable by `authenticated`; pg_cron + pg_net + vault present). Do not re-apply.
  `db/003_cron.sql` (written this arc) is applied by Cowork at close, after the Edge Function secrets exist.

RULE: originality — pastel register and floating-bar pattern are shared conventions; palette values, glyphs
and copy are ours. Never trace SF Symbols or Structured's glyphs.
RULE: Edge Function deploys and secrets are Cowork's/Mark's (guarded, ezbr_sha256 proof) — Code commits
`supabase/functions/*` + `db/*.sql` and continues; it never deploys.
RULE: iCloud app-specific password never reaches the client store or logs: it is posted once to
`calendar-connect`, encrypted server-side (PLANNER_KEK), and only the ciphertext is stored.
RULE: press is written only in slice 6 and published only at close AFTER the optimo merge (one writer on press).

```
Work order — optimo arc 2: look & feel, iCloud calendar, push reminders, family-wing card

Repo: /Users/mark/Documents/code/optimo   (GitHub: schnubsy/optimo)
MAIN CHECKOUT: /Users/mark/Documents/code/optimo
INBOX FILES: none (ARC.md is the inbox; docs/design/2026-09-27-* and db/002_calendar_push.sql are committed)
Branch: git checkout -b arc/v0-2-meadow

STANDING RULES (verbatim in every order)
(1) Plan mode ONCE at the start. Batch every question up front, then run every slice back-to-back with
    no further pauses. Return only at arc-complete or a genuine blocker.
(2) Session branch arc/<slug>. `git add` by name only, never `-A`. Never `rm -rf` (use `rm -r`). Never
    remove or move a git worktree inside the order.
(3) PER-SLICE LOOP (every slice): extend the tests to cover the slice → build/typecheck/lint clean →
    run the gauntlet (skills/_shared/references/testing.md) → capture done-proof into
    docs/evidence/<arc>-slice-<N>-<name>.<ext> IN THE REPO → commit `feat: slice <N> — <summary>` →
    run /council:handoff → next slice, without returning.
    Per-slice `/council:handoff` is **tick + commit ONLY**: tick this slice `Status: done <sha>` in
    ARC.md and commit — nothing else. The FULL close (CLAUDE.md Current stage, docs/history.md,
    docs/lessons.md, HANDOFF.md overwrite, ARC.md truncate) does NOT run per slice; it runs ONCE at
    arc-complete, BEFORE the PR (rule 4), so it ships inside the same PR.
(4) ARC-COMPLETE CLOSE (fully automatic once gauntlet + sentry are BOTH green):
      FULL CLOSE FIRST (runs ONCE, BEFORE the PR so it ships in the same PR): the final
      `/council:handoff` — overwrite CLAUDE.md Current stage, prepend docs/history.md, promote
      docs/lessons.md, overwrite HANDOFF.md, tick every slice + truncate ARC.md — committed on the
      branch → THEN
      push branch → `gh pr create --fill --base main` → `gh pr merge --merge --delete-branch`
      → RECONCILE THE MAIN CHECKOUT (mandatory, immediately after the merge):
          git -C <MAIN CHECKOUT> checkout main && git -C <MAIN CHECKOUT> pull --ff-only
        then ASSERT `git -C <MAIN CHECKOUT> rev-parse HEAD` == the merge commit SHA. The arc is NOT
        closed until this passes. Every manual step Mark runs next — deploy, publish, build — runs
        against the MAIN CHECKOUT's working tree, not against GitHub; a merged PR over a stale main
        checkout ships the PREVIOUS arc's code and reports success. If the pull cannot fast-forward,
        STOP and report a blocker; never force it.
      → if the project is a marquee page: PUBLISH via the press instrument, **strictly AFTER the merge
        and the main-checkout reconcile — publishing before merge is a RED close** (it ships the
        pre-merge tree). Build → copy to ~/Documents/code/press/<page>.html [+ its assets dir] →
        commit → push; verify the live URL returns 200 AND `git hash-object <file>` == the GitHub blob
        SHA (this is the press case of SHIP PROOF — control-files.md)
      → SHIP PROOF for anything this arc deployed or published, per control-files.md → "Verify the
        artifact, not the act": fingerprint before AND after, assert it CHANGED and matches source.
        A deploy this arc cannot prove is a RED gate, not a footnote.
      → INBOX CLEANUP: after the merge, remove the now-duplicate uncommitted inbox copies (ARC.md +
        INBOX FILES) from the MAIN CHECKOUT **only if** each is byte-identical (`git hash-object`) to its
        merged version; if any differs, LEAVE it and report the mismatch.
      → report: commits, PR URL, live URL, evidence files, Mark's manual steps (the full close/handoff
        already ran BEFORE the PR, per the top of this rule — it is not repeated here).
      → CLOSE-OUT MANIFEST (the close is not complete until this is emitted). Enumerate EVERY
        required close step and give each EXACTLY ONE explicit outcome — never silence, never prose:
          push · PR · merge · reconcile main checkout · migrations/backfills · deploy · publish ·
          inbox cleanup · handoff
        Per step, one of:
          DONE     + its proof (sha, hash, version fingerprint, URL status) — an assertion is not proof
          N/A      + one line saying why it does not apply to this project
          BLOCKED  + it goes to HANDOFF "Mark's manual steps" as a NUMBERED item carrying its guarded
                     command (precondition && action && postcondition) and the expected postcondition value
        A step that is neither DONE, N/A nor BLOCKED is a RED close. Absence is the failure mode this
        exists to catch: on 2026-09-21 a required publish was simply missing from the report and
        nobody noticed for four hours.
    If either gate is RED: stop at the last green slice, leave the branch pushed, open the PR as DRAFT,
    and report. Nothing else returns to Mark.
(5) Publishing is PART OF THE CLOSE — the old "press publishing stays Mark's" rule is retired. Publish
    strictly AFTER merge + the main-checkout reconcile; **publishing before merge is a RED close.**
(6) Never claim "deployed" / "published" / "live" from a command's exit code, a printed success line,
    or an incremented version number. Ship proof or it did not ship.

ORIENT FIRST
INBOX SYNC (first, before reading anything): if this session is in a git worktree
(`git rev-parse --git-common-dir` ≠ `.git`), copy ARC.md from MAIN CHECKOUT into the worktree byte-identical
(verify with `git hash-object` both sides) — never reconstruct a file the order says exists; if ARC.md is still
empty afterwards, STOP and report a blocker (control-files.md "Inbox delivery").
Read: CLAUDE.md, HANDOFF.md, ARC.md, docs/spec.md, docs/design/2026-09-27-final/design-system-prompt.md,
docs/design/2026-09-27-final/spec.md. Then spawn ONE Explore sub-agent to read docs/lessons.md + docs/history.md
+ the council dossiers and return ONLY the lines relevant to: tokens/css, dnd/resize, pwa/service worker,
supabase edge functions, caldav, web push, press tenants/release, github pages.
Project-specific: optimo deploys to GitHub Pages on merge to main (ship proof = `<meta name="build">` on the live
URL == merge SHA). The PRESS publish (slice 6's launcher page) runs at close, strictly after the optimo merge +
reconcile, via optimo's own `tools/release.js` (Lane A, hash-verify) — press case of SHIP PROOF. Edge Functions
are NOT deployed by Code: commit them, record the guarded deploy commands in HANDOFF "Mark's manual steps".
Open `gh issue list --label snag` for #1–#12 acceptance text.

=== SLICE 1 — snags + the resize bug (test first) ===
Status: done 69490d3
Scope: close #1–#12 and fix resize-by-edge so `duration_min` persists (today it only changes visually).
Files in play: src/timeline/Block.tsx (onResizeUp → commit through the repo layer with field_ts stamp), the files
  each Issue names, tests/unit/layout.test.ts, tests/timeline.spec.ts (+ a resize-persist case that reloads and
  asserts the stored duration), tests for each Issue.
Implementation: reproduce each defect with a failing test first; fix; `Fixes #n` in the commit body per Issue.
  Resize: commit on pointer-up ONLY (never per move), snap per setting, min 5 min, 44px handle band, keyboard
  Shift+↑/↓ ±5 min; the editor sheet reflects the new duration without reopening.
Done-criteria: 13 new/extended tests green · reload-after-resize shows the new duration and the row in the fake
  server carries it · gauntlet GREEN · evidence: test log + before/after screenshot.

=== SLICE 2 — design system: tokens, type, pills, chip-as-complete, free-time pill, sweep ===
Status: done e65753c
Scope: implement docs/design/2026-09-27-final/design-system-prompt.md sections 1–3 (tokens/base, timeline
  block, free-time connector, now line, inbox row, editor sheet, week compact block, settings) — data and sync
  code untouched.
Files in play: src/styles/tokens.css (REPLACE with docs/design/2026-09-27-final/tokens.css), src/styles/base.css,
  index.html (Nunito Sans 400/600/700/800 link, theme-color meta per theme), src/timeline/*, src/views/*,
  src/editor/TaskSheet.tsx, src/components/*, tests/unit/contrast.test.ts (new: compute the a11y table from
  tokens.css and assert every pair ≥ 4.5:1 in both modes), tests/timeline.spec.ts, tests/inbox.spec.ts.
Implementation: pills r22 (min 32px, radius = min(22px, h/2)), left 32px chip with 44px hit area = complete
  control (tap/Space/X; aria-pressed; Undo toast 5 s); done = check glyph + neutral pill + strike; running =
  elapsed tone-sweep ::after; free-time = 2px dotted rule centred with the pill label "1h 15m free" and a "+"
  that creates at the gap start; priority = 2px ring on chip; category = pastel hue pair from tokens; dark mode
  via [data-theme]; reduced-motion honoured. Remove the checkbox everywhere (timeline, inbox, week, editor).
Done-criteria: contrast.test.ts green for all 8 hues × 2 modes · no checkbox in the DOM (test) · chip completes
  and undoes · axe clean · gauntlet GREEN · evidence: iPhone + desktop, light + dark screenshots of Day/Inbox/Week.

=== SLICE 3 — chrome + icons: floating tab bar, FAB, header fade, glyph set, auto-suggest ===
Status: done 48b9eda
Scope: design-system-prompt.md sections 4–5.
Files in play: src/chrome/{TabBar,Fab,HeaderFade,Segmented}.tsx, src/App.tsx (layout: timeline scrolls to the
  screen bottom under the bar; safe-area padding), src/icons/* (redraw 64 activity + 12 chrome glyphs per spec.md
  naming list; 24px, filled, 2px radii, optically centred; export index + `groups`), src/quickadd/suggest.ts
  (keyword→icon map, ~80 entries, used by QuickAdd and the editor's icon picker), tests/unit/suggest.test.ts,
  tests/chrome.spec.ts, tests/unit/icons.test.ts (every glyph renders, viewBox 0 0 24 24, no external refs).
Implementation: iPhone tab bar = floating pill (blur + 80% canvas, opaque fallback under reduced-transparency),
  tabs Inbox · Timeline · Week · Settings (+ hidden reserved "Plan" slot, feature-flagged off), separate round
  FAB bottom-right opening QuickAdd; header = date strip on canvas→transparent fade, no border; desktop =
  inbox rail + floating Day/Week/Month segmented pill top-left of the timeline pane. Icon picker groups by
  spec.md categories; quick-add previews the suggested icon.
Done-criteria: chrome.spec.ts on iPhone: last hour of the day is reachable under the bar; FAB opens quick-add;
  tabs switch views; desktop segmented switches views · suggest.test.ts ≥ 30 cases ("Dentist" → tooth,
  "Standup" → people, "Run" → shoe…) · icons.test.ts green · Lighthouse a11y ≥ 90 · gauntlet GREEN · evidence:
  icon sheet render + iPhone screenshots light/dark.

=== SLICE 4 — iCloud calendar (CalDAV, read-only) ===
Status: done 7ce7f62
Scope: connect an iCloud account with an app-specific password; show its events on the timeline as fixed
  "event" blocks; refresh on open and every 15 min.
Files in play: supabase/functions/_shared/{crypto.ts,caldav.ts,ics.ts}, supabase/functions/calendar-connect/
  index.ts, supabase/functions/calendar-sync/index.ts, supabase/functions/deno.json, src/calendar/{api.ts,
  events.ts}, src/views/Settings.tsx (Calendars section), src/timeline/EventBlock.tsx, src/data/db.ts (events
  table + pull of `planner_events` via the sync log), tests/unit/{ics,caldav}.test.ts, tests/fake/caldav.ts
  (hermetic CalDAV server: PROPFIND principal/home-set/calendars, REPORT calendar-query returning fixture ICS
  incl. a recurring event), tests/calendar.spec.ts, docs/spec.md §3 (arc 2 now).
Implementation:
  - calendar-connect (JWT): body {username, password, label} → PROPFIND https://caldav.icloud.com/ with Basic
    auth → current-user-principal → calendar-home-set → list calendars (displayname, color, supported-
    component VEVENT) → AES-GCM encrypt password with PLANNER_KEK (32-byte base64 secret; 12-byte IV; store
    base64(iv|ct)) → insert planner_calendar_accounts via service role → return the public row. Wrong
    password → 401 with a plain message; never log the password.
  - calendar-sync (JWT for the client, or x-cron-secret === CRON_SECRET for cron): per enabled account,
    decrypt, REPORT calendar-query time-range [now−7d, now+60d] on enabled calendars, parse ICS with
    `npm:ical.js`, expand RRULEs inside the range, upsert planner_events (etag-aware), tombstone events no
    longer returned; set last_sync_at / last_error.
  - Client: Settings → Calendars: connect form (Apple ID, app-specific password, help link to
    appleid.apple.com → App-Specific Passwords), per-calendar toggles (updates `calendars` via the public
    grants), Sync now, disconnect. On app open + every 15 min while visible: invoke calendar-sync then pull.
    Events render as outlined (not filled) pills with a small calendar chip, not draggable/resizable, tap
    shows details; overlap layout shares columns with tasks; free-time connectors account for events.
  - Secrets required at deploy: PLANNER_KEK, CRON_SECRET (generated by `scripts/secrets.mjs` into the
    gitignored `.secrets/planner.env` and printed as the guarded `supabase secrets set` command for HANDOFF).
Done-criteria: unit tests for encrypt/decrypt round-trip, ICS parse + RRULE expansion, CalDAV XML parsing ·
  calendar.spec.ts against the fake CalDAV + fake PostgREST: connect → calendars listed → events appear on
  the timeline for today → disconnect removes them · no password string in any log/evidence (grep gate) ·
  `deno check` + `deno test` for functions · gauntlet GREEN · evidence: screenshots + function test log.

=== SLICE 5 — web push reminders ===
Status: done 4ab0ef6
Scope: reminders fire as push notifications on the installed PWA (iPhone) and desktop browsers.
Files in play: src/sw.ts (custom Workbox SW via `injectManifest`: push + notificationclick handlers),
  vite.config.ts (strategies: 'injectManifest'), src/push/{subscribe.ts,api.ts}, src/views/Settings.tsx
  (Reminders: enable push → permission → subscribe → planner_push_subscriptions row; test notification),
  supabase/functions/push-send/index.ts (`npm:web-push`; every minute: due reminders in [now, now+60s) for
  scheduled tasks and series occurrences (npm:rrule) minus planner_reminder_sent; send to all live
  subscriptions; prune 404/410 endpoints; record sent), scripts/vapid.mjs (keygen → .secrets/planner.env
  + VITE_VAPID_PUBLIC_KEY into .env.production), db/003_cron.sql (vault secret `planner_cron_secret`;
  pg_cron every minute → net.http_post(push-send, x-cron-secret) and every 15 min → calendar-sync),
  tests/unit/due.test.ts, tests/push.spec.ts (Playwright: grant permission, subscribe row written to the
  fake server; SW receives a simulated push → notification shown), docs/spec.md §2.1 reminders.
Implementation: in-app reminders stay as the fallback when push is off; reminder lead times from settings;
  notification payload {title, body "in 10 min · 14:00", tag task_id, url to the day}; click focuses the day.
Done-criteria: due.test.ts ≥ 12 cases (plain, series, exception-moved, skipped, already-sent) · push.spec.ts
  green on desktop Chromium · SW still passes offline.spec.ts · db/003_cron.sql lint-clean (not applied) ·
  gauntlet GREEN · evidence: screenshots of Settings → Reminders + a captured notification.

=== SLICE 6 — family-wing launcher card on the press marquee ===
Status: done d71fe04
Scope: `optimo.html` in the press FAMILY space: gated by the family gate, shows one card ("optimo — one
  timeline for the day", the app's icon, "Open optimo" → https://schnubsy.github.io/optimo/). Marquee shell +
  tenant app source, per arc.md "Tenant-change arcs"; press is committed on branch `arc/optimo-card` in
  ~/Documents/code/press and PUBLISHED ONLY AT CLOSE.
Files in play (optimo): src-press/optimo.html (source, vendored gate at src/vendor/family-gate.js copied
  byte-identical from ~/Documents/code/press/src/family-gate.js), build-press.mjs (inline → dist/optimo.html,
  deterministic), tools/release.js (modelled on ~/Documents/code/remit/tools/release.js: publish-checks,
  spaces.json family membership check, sha256 copy to press/optimo.html, pages.json entry, hash re-verify;
  PRESS_DIR override), tools/publish-checks.mjs, db/press/optimo_grant.sql (press_access_grants row for
  page 'optimo.html' + Mark's email, per db/20260921_press_access.sql — applied by Cowork).
Files in play (press, branch arc/optimo-card): spaces.json (add "optimo.html" to family), tenants.json entry
  {repo:"optimo", tier:"family", gate:"src/family-gate.js", vendored:"src/vendor/family-gate.js",
  release:"tools/release.js", build:"node build-press.mjs", output:"dist/optimo.html", deterministic:true},
  ARC.md one-line pointer "→ optimo ARC.md 2026-09-27 arc 2, slice 6". `node tools/tenants-check.mjs` must
  exit 0. Do NOT touch pages.json or any *.html in press here — release.js writes those at close.
Done-criteria: dist/optimo.html builds deterministically (two builds, same hash) · vendored gate hash ==
  press canonical · publish-checks green · tenants-check 0 · Playwright: gated page shows sign-in, then the
  card (fake gate session) · gauntlet GREEN · evidence: card screenshot.

=== SLICE 7 — design review + P0 fixes + performance + close ===
Status: done 3158271
Scope: the standard UI-arc slices, then the close.
Implementation: the Eye runs a LITE critique of this arc's evidence screenshots against
  docs/design/2026-09-27-final/final.html + spec.md; only 🔴 P0 findings are fixed here (🟡 → Issues labelled
  `snag`). Performance: perf.spec.ts still under budget with events on the timeline; Lighthouse mobile ≥ 85/90
  with the blurred bars (fall back to opaque if the budget fails). Then rule (4).
Close specifics for THIS arc (each gets an explicit outcome in the manifest):
  - deploy: Pages build meta == merge SHA on the live URL.
  - migrations: db/002 DONE (pre-applied); db/003_cron.sql → BLOCKED (Cowork applies after secrets).
  - Edge Functions calendar-connect / calendar-sync / push-send → BLOCKED: HANDOFF "Mark's manual steps" lists
    (1) `supabase secrets set` from .secrets/planner.env (guarded: file exists && set && `supabase secrets
    list` shows the 5 names), (2) the three guarded deploy commands with the expected ezbr_sha256 change,
    (3) db/003_cron.sql apply, (4) db/press/optimo_grant.sql apply, (5) iCloud app-specific password entry
    in Settings on the live app — with the postcondition for each.
  - publish: press launcher via tools/release.js strictly after the optimo merge + reconcile; verify live
    https://schnubsy.github.io/press/optimo.html returns 200 and `git hash-object` == GitHub blob SHA; press
    branch merged to press main and deleted.
  - HANDOFF "Exact next steps": arc-3 checkpoint (AI planning layer; the reserved Plan tab).

RETURN POINTS: arc-complete, or genuinely blocked. Errors are fixed, re-run, and re-validated inside the order —
nothing else returns to Mark.
```
