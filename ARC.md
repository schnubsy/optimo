## 2026-09-26 — Arc 1: v0.1 baseline (kickoff decisions + work order)

DECISIONS (ratified 2026-09-26): name **optimo** · React 18 + TS + Vite PWA · Supabase `press` with `planner_*`
tables, field-level LWW sync (`docs/spec.md` §5) · Supabase Auth magic link · own GitHub Pages site
`schnubsy.github.io/optimo/` · on-device NLP (chrono-node + rrule) · in-app reminders only in v0.1 ·
design = Eye LITE **Switchboard** (`docs/design/2026-09-26-lite/directions.md`, runner-up Slack Water).
`db/001_planner.sql` is ALREADY APPLIED to press (verified 2026-09-26: 8 triggers, 5 policies, realtime on
`planner_sync_log`, cron purge job; merge round-trip newer-field-wins confirmed). Do not re-apply.
Deferred to arc 2: calendar provider (Google vs iCloud), web push, marquee portal link card. Arc 3: AI planning.

RULE: originality gate — no Structured.app (or any planner's) look, copy, icon set or naming; icons drawn in-repo.
RULE: only `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in the client; every other secret is server-side.
RULE: Code never applies DDL; `db/*.sql` is committed by Code and applied by Cowork.

```
Work order — optimo arc 1: v0.1 baseline

Repo: /Users/mark/Documents/code/optimo   (GitHub: schnubsy/optimo — created in slice 1)
MAIN CHECKOUT: /Users/mark/Documents/code/optimo
INBOX FILES: none (ARC.md is the inbox; every other kickoff file is committed in `chore: project kickoff`)
Branch: git checkout -b arc/v0-1-baseline

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
(`git rev-parse --git-common-dir` ≠ `.git`), copy ARC.md + every file on the INBOX FILES line from
MAIN CHECKOUT into the worktree byte-identical (verify with `git hash-object` both sides) — never
reconstruct a file the order says exists; if ARC.md is still empty afterwards, STOP and report a blocker
(control-files.md "Inbox delivery").
Read: CLAUDE.md, HANDOFF.md, ARC.md, docs/spec.md, docs/design/2026-09-26-lite/directions.md. Then spawn
ONE Explore sub-agent to read docs/lessons.md + docs/history.md + the council dossiers and return ONLY the
lines relevant to: react, vite, pwa, dexie, supabase sync, dnd, github pages.
Project-specific: this repo is not a marquee page — the press PUBLISH step is N/A; the deploy is GitHub
Pages via Actions on merge to main (ship proof in slice 1). No Edge Functions this arc.

=== SLICE 1 — repo, toolchain, shell, Pages deploy ===
Status: done 6a7ad01
Scope: GitHub remote; Vite React-TS app under the scaffold; test toolchain; CI deploy to Pages with ship proof.
Files in play: package.json, vite.config.ts, tsconfig*.json, index.html, src/main.tsx, src/App.tsx,
  src/styles/tokens.css, src/styles/base.css, .env.production, .env.example, .github/workflows/pages.yml,
  tests/smoke.spec.ts (extend, keep), playwright.config.ts (keep), scripts/gauntlet.sh (keep), README.md.
Implementation:
  - `gh repo create schnubsy/optimo --private --source=. --remote=origin --push` (main = kickoff commit).
    Enable Pages from Actions: `gh api -X POST repos/schnubsy/optimo/pages -f build_type=workflow`.
  - Scaffold Vite in a temp dir (`npm create vite@latest tmp -- --template react-ts`), MOVE its files into
    the repo without overwriting any kickoff file; delete the temp dir. `base: '/optimo/'`.
  - Deps: react, react-dom, dexie, dexie-react-hooks, @dnd-kit/core, @dnd-kit/modifiers, zustand,
    chrono-node, rrule, uuid (v7), @supabase/supabase-js, vite-plugin-pwa. Dev: vitest, jsdom,
    @testing-library/react, @playwright/test, @axe-core/playwright, lighthouse, eslint, typescript-eslint.
  - Tokens: paste the Switchboard block from directions.md into src/styles/tokens.css verbatim; base.css sets
    `color-scheme`, fonts (Chivo + Chivo Mono via Google Fonts `<link>`), `data-theme` on <html>.
  - `<meta name="build" content="%BUILD%">`: vite plugin replaces with `process.env.GITHUB_SHA ?? git rev-parse
    --short HEAD` at build. `<title>optimo</title>`, `<main>` landmark, a placeholder day view heading.
  - .env.production: VITE_SUPABASE_URL=https://eepjhpyziczrxvirczio.supabase.co and VITE_SUPABASE_ANON_KEY=
    the press publishable anon key — read it from ~/Documents/code/giving-tracker (grep the `supabase` const);
    never a service key. .env.example mirrors the names with blank values.
  - pages.yml: on push to main → npm ci → npm run build → actions/upload-pages-artifact (dist) →
    actions/deploy-pages. Permissions pages:write, id-token:write.
  - scripts: "dev", "build", "preview", "test" (vitest run), "lint", "typecheck" (tsc --noEmit).
Done-criteria: `scripts/gauntlet.sh arc1` GREEN on the shell (unit ≥1 test, smoke desktop+iPhone, axe, Lighthouse
  ≥85/≥90) · pushed to origin main · Pages workflow green · `curl -s https://schnubsy.github.io/optimo/ | grep
  -o 'name="build" content="[0-9a-f]*"'` equals the pushed SHA prefix (SHIP PROOF; evidence file records both).

=== SLICE 2 — data layer, auth, sync engine ===
Status: done 63e9f46
Scope: local store, Supabase Auth, outbox/pull sync implementing docs/spec.md §5 exactly.
Files in play: src/data/db.ts (Dexie schema), src/data/types.ts, src/data/repo.ts (CRUD that stamps field_ts +
  writes outbox), src/sync/engine.ts (push/pull/cursor/realtime/poll), src/sync/merge.ts (pure field-level LWW,
  same algorithm as planner_merge), src/auth/*, src/components/SignIn.tsx, src/components/SyncBadge.tsx,
  tests/unit/merge.test.ts, tests/unit/repo.test.ts, tests/sync.spec.ts.
Implementation:
  - Dexie tables mirror the 4 planner tables + `outbox` {seq, table, id, op, payload, field_ts} + `meta` {cursor,
    device_id}. Indexes: tasks [start_at], [category_id], compound for inbox (start_at=null, sort_key).
  - Every local write: set field_ts[field]=Date.now() for changed fields, updated_at, enqueue outbox. Deletes =
    deleted_at tombstone. ids = uuid v7.
  - Push: batch outbox by table → `upsert(..., {onConflict:'id'})` (exceptions: composite) → drop outbox rows on
    2xx; on network failure keep and back off (1s→60s). Pull: `planner_sync_log?seq=gt.<cursor>&order=seq` →
    fetch rows by id (`in.(...)`, chunks of 100) → merge.ts → advance cursor. Realtime channel on planner_sync_log
    (filter user_id) triggers pull; 60 s poll fallback; `online` event triggers push+pull.
  - Auth: magic link (`signInWithOtp`), session persisted; SignIn screen is the only unauthenticated route.
    RLS isolates users — no allow-list needed.
  - SyncBadge: synced / pending n / offline / error, aria-live polite.
Done-criteria: merge.test.ts proves newer-field-wins + tombstone + ts-merge (mirror the SQL round-trip in the
  DECISIONS block) · repo.test.ts proves outbox stamping · tests/sync.spec.ts: two browser contexts (same magic-link
  session injected via storageState) edit different fields of one task offline, go online, both converge to the
  merged row within 5 s · gauntlet GREEN · evidence: sync spec trace + a screenshot of SyncBadge states.

=== SLICE 3 — day timeline, drag/resize, task editor ===
Status: done 2328bd2
Scope: the hero view per Switchboard mock (desktop two-pane, mobile single pane).
Files in play: src/views/Day.tsx, src/timeline/{Timeline,HourRail,NowLine,Block,FreeRow,AllDayStrip}.tsx,
  src/timeline/layout.ts (overlap columns, snap, bounds), src/editor/TaskSheet.tsx, src/state/ui.ts,
  tests/unit/layout.test.ts, tests/timeline.spec.ts.
Implementation: hour rail from settings day_start..day_end (default 06:00–22:00, out-of-bounds dimmed);
  now-line updates every 30 s; blocks absolutely positioned, height=duration; overlaps → side-by-side columns;
  free time rendered as dashed drop rows (Switchboard); tap empty slot → new task at that time; @dnd-kit pointer
  sensors, transform-only during drag, commit on drop with snap (setting 5/10/15); resize handle (44px band on
  selected block, mobile) changes duration_min; TaskSheet (bottom sheet mobile / side panel desktop): title, notes,
  category, priority, start, duration, all-day, subtasks, reminders, complete, "adjust to actual" prompt when
  completing early/late; keyboard: arrows nudge 5 min, Enter edit, Del delete, Cmd/Ctrl+K quick-add focus.
Done-criteria: layout.test.ts (overlap columns, snap, bounds) · timeline.spec.ts on desktop+iPhone: create at slot,
  drag reschedules (start_at changes by dragged delta), resize changes duration, complete toggles, no console
  errors · axe clean · gauntlet GREEN · evidence screenshots desktop + iPhone (dark + light).

=== SLICE 4 — inbox, quick-add NLP, categories / icons / priority ===
Status: done 985c551
Scope: unscheduled work and fast capture.
Files in play: src/views/Inbox.tsx (rail / bottom sheet), src/quickadd/{QuickAdd.tsx,parse.ts}, src/categories/*,
  src/icons/ (≥40 original 24px line SVGs as React components + index), src/components/PlacePicker.tsx,
  tests/unit/parse.test.ts, tests/inbox.spec.ts.
Implementation: inbox ordered priority desc then sort_key (fractional reorder on drag); drag inbox→timeline
  schedules, timeline→inbox unschedules; mobile "Place" opens PlacePicker listing free slots today first;
  parse.ts per spec §2.4 (chrono-node + grammar: `for 45m|1h`, `#cat`, `!`/`!!`/`!!!`, `every …` → RRULE, `@icon`);
  QuickAdd shows a parse-preview row before commit; categories CRUD with 8 token swatches + icon picker; priority
  = edge tint only.
Done-criteria: parse.test.ts ≥ 20 cases incl. "Lunch with Sam at 1pm" → {title:'Lunch with Sam', start today
  13:00} and "Gym every weekday for 1h #health !!" · inbox.spec.ts desktop+iPhone: quick-add → inbox, drag/Place →
  timeline, unschedule back · gauntlet GREEN · evidence screenshots + icon sheet render.

=== SLICE 5 — recurrence, week + month, subtasks/reminders, settings, focus mode ===
Status: done 703960c
Scope: the rest of baseline parity.
Files in play: src/recurrence/{materialize.ts,exceptions.ts}, src/views/{Week,Month}.tsx, src/focus/Focus.tsx,
  src/reminders/scheduler.ts (in-app: Notification API if granted, else toast), src/views/Settings.tsx,
  src/data/export.ts, tests/unit/recurrence.test.ts, tests/week.spec.ts.
Implementation: series rows (rrule + dtstart) materialised for the visible range via `rrule`; per-occurrence edits
  write planner_exceptions (override task row with series_id) or skipped; "this / this and following / all" on
  edit; completion per occurrence; week view 7 columns with drag between days + planned/free hours per day header;
  month dots; settings per spec §2.7 incl. theme (system/light/dark → data-theme), JSON export/import; focus mode
  full-screen timer with subtasks and complete / +5 / stop.
Done-criteria: recurrence.test.ts (daily/weekday/weekly/monthly, exception override, skip, split-following) ·
  week.spec.ts drag between days + theme toggle persists · gauntlet GREEN · evidence screenshots week/month/focus.

=== SLICE 6 — offline PWA + performance at scale ===
Status: done 70af207
Scope: installable, fully offline, fast with 5k tasks.
Files in play: vite.config.ts (vite-plugin-pwa: manifest, icons from src/icons brand mark, Workbox precache +
  navigateFallback), src/sw-register.ts, src/timeline/virtual.ts, src/inbox/virtual.ts, tests/offline.spec.ts,
  tests/perf.spec.ts, scripts/seed.ts (5 000 tasks + 200 series).
Implementation: precache app shell; `context.setOffline(true)` flows work end-to-end; outbox flush on reconnect;
  virtualise timeline blocks outside viewport ±1 screen and inbox list; date-range Dexie queries only; no layout
  thrash during drag (transform + will-change); measure with `performance.mark` and assert in perf.spec.ts.
Done-criteria: offline.spec.ts: load online → go offline → create/move/complete → reload offline still shows them →
  online → rows appear in Supabase (via a second context pull) · perf.spec.ts with seed: day view ready < 200 ms
  after data, inbox filter < 50 ms, 60 drag frames without a long task > 50 ms · Lighthouse mobile ≥ 85/≥ 90 · PWA
  installable (manifest + SW audit green) · gauntlet GREEN · evidence: perf numbers table + Lighthouse JSON.

=== SLICE 7 — design review + P0 fixes + close ===
Scope: the standard UI-arc slices, then the arc-complete close.
Implementation: the Eye runs a LITE critique on this arc's evidence screenshots against
  docs/design/2026-09-26-lite/direction-2-switchboard.html and the Flow findings in directions.md; only 🔴 P0
  findings are actioned as fixes here (🟡 → GitHub Issues labelled `snag`). Re-run the full gauntlet. Then rule (4):
  full close → PR → merge → reconcile main checkout → Pages deploy ship proof (build meta == merge SHA on the live
  URL) → close-out manifest.
Done-criteria: critique file in docs/evidence/ · zero open P0 · gauntlet GREEN · live URL serves the merge SHA ·
  HANDOFF.md lists arc-2 checkpoint items (calendar provider, web push, marquee link card).

RETURN POINTS: arc-complete, or genuinely blocked. Errors are fixed, re-run, and re-validated inside the order —
nothing else returns to Mark.
```
