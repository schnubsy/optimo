# optimo — Claude instructions

## Purpose

Personal daily-planner web app (responsive PWA, desktop + iPhone) in the Structured.app category:
day timeline + inbox + week/month views, drag-and-drop time-blocking, categories/icons/priorities,
recurrence, focus mode, offline-first with sync. Later arcs: calendar sync, then an AI layer that turns
written intent into a scheduled day. Single user (Mark). Everything original — no proprietary look, copy or icons.

## Stack & how to run

- **TypeScript · React 18 · Vite · CSS variables** (tokens: `src/styles/tokens.css` = Eye FINAL "Meadow" verbatim + `tokens-a11y.css`).
- **DnD** `@dnd-kit/core` · **local store** `dexie` (IndexedDB) · **PWA** `vite-plugin-pwa` · NLP `chrono-node` + `rrule`.
- **Backend** Supabase project `press` (`eepjhpyziczrxvirczio`), tables `planner_*`, RLS, Supabase Auth magic link.
  Migrations in `db/*.sql` — applied by **either surface via the claude.ai Supabase connector** (Supabase channel, Project rules).
- **Hosting** GitHub Pages `https://schnubsy.github.io/optimo/` via `.github/workflows/pages.yml` on `main` (`base: '/optimo/'`).

```bash
npm install
npm run dev                 # Vite dev server
npm run build               # static build → dist/
npm test                    # vitest
npx playwright test         # smoke: desktop + iPhone 15 + axe
scripts/gauntlet.sh         # unit + Playwright + axe + Lighthouse budgets → docs/evidence/
```

- **Cloud is the primary home (arc 7).** A session clones `schnubsy/optimo`, branches `arc/*`, runs the gauntlet in
  cloud mode (auto: Chromium only, iPhone = Chromium emulation, deno via npm), opens a PR, merges → Pages deploys. GitHub
  holds everything; the Mac only `git pull`s. No `MAIN CHECKOUT` / inbox-sync step when the session is cloud-only.
  Real-Safari checks (safe areas, standalone PWA, backdrop-filter) stay on Mark's iPhone list in HANDOFF.

## Current stage

Merge state: Merged: PR #112 ce67e23 on 2026-10-09; main checkout on main @ ce67e23 (cloud session; the Mac pulls)
**Arc 7 — Inbox-first (2026-10-09), all 10 slices done, built from the cloud.** Capture is one line (FAB / N / command
line) → Inbox untimed, no estimate; the inbox processes items to Today · a day · Someday + estimates; each day has a
"To place" tray (drag onto the timeline, Place, Fit with AI); desktop Week is readable again (titles, lanes, planned ·
free, now-line, trays). `db/008_inbox_first.sql` applied (plan_date / someday / estimated; place is derived). QA bug
sweep: every baseline P0/P1 fixed except #51, #70, week at 1024, nested-lane squeeze. **Next:** Mark's real-iPhone
checks + UI tweaks (HANDOFF), then arc 5b (people). Snags #81–#110, #67–#79, #39–#65 open.

## Project rules

Global rules: council arc instrument
- **Originality gate (rewritten 2026-10-09, arc 6):** structure, flow, sizes and colours may follow the 2026-10-09 mockups exactly; glyph artwork is always drawn in-repo on the 24 px grid (never traced from any icon set), copy strings are ours (free-time phrases, bookend names, suggestion seeds), the name stays optimo. Icons are drawn in-repo (`src/icons/set.ts`); fonts from Google Fonts only.
- **Sync contract is the API.** Any client (web now, Swift later) speaks only: outbox + `field_ts` + pull
  cursor over PostgREST (`docs/spec.md` §5). No client-specific server logic.
- **Only publishable keys in the client** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). All other
  secrets live in Edge Function secrets.
- **Supabase channel:** `db/*.sql` is committed; either surface applies migrations, runs SQL and deploys Edge Functions directly via the claude.ai Supabase connector. Code does it inside its order with no stop; Cowork does it directly when it is driving. BUG WORKAROUND (temporary — anthropics/claude-code #94450): Cowork auto-cancels Supabase's delete-confirmation pop-up. Remove this line as soon as Anthropic fixes it; a weekly scheduled task watches for the fix ("Watch: Cowork Supabase pop-up bug (#94450)", `trig_01F7pKxdREuca4Yu8BWpRgiJ`). Until then, route only SQL that trips that pop-up (drop/delete/truncate etc.) to Code, where Mark confirms it. Secrets stay with Mark or Cowork.
- **Perf budgets are gates:** 5k-task library, 60 fps drag (transforms only), Lighthouse perf ≥ 85 / a11y ≥ 90.
- **Ship proof** for every Pages deploy: `<meta name="build">` on the live URL must equal the merged SHA.

## Where things live

| Path | Purpose |
|---|---|
| `docs/spec.md` | Functional + technical spec, data/sync contract |
| `docs/design/` | Eye design packs (LITE 2026-09-26: three directions + tokens) |
| `docs/lessons.md` · `docs/history.md` · `docs/evidence/` | Lessons (tagged) · arc log · done-proof |
| `db/` | Applied Supabase migrations |
| `scripts/gauntlet.sh` · `tests/` | Ship gate · Playwright smoke |
| `ARC.md` · `HANDOFF.md` | Arc inbox · arc-close on-ramp |
