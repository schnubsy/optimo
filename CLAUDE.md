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
  Migrations in `db/*.sql` — applied by **Cowork's Supabase connector**, never from Code.
- **Hosting** GitHub Pages `https://schnubsy.github.io/optimo/` via `.github/workflows/pages.yml` on `main` (`base: '/optimo/'`).

```bash
npm install
npm run dev                 # Vite dev server
npm run build               # static build → dist/
npm test                    # vitest
npx playwright test         # smoke: desktop + iPhone 15 + axe
scripts/gauntlet.sh         # unit + Playwright + axe + Lighthouse budgets → docs/evidence/
```

## Current stage

**Arc 4 — iCloud two-way sync + calendar picker: complete on `arc/icloud-two-way`, closing (PR → merge → Pages ship
proof).** Discovery fixed (iCloud's single-quoted `name='VEVENT'` dropped every calendar) and re-run every sync; honest
status ("Found N calendars · synced HH:MM · N events" / "No calendars found"). Settings → Calendars lists own + shared
calendars with read switches and a "Put optimo tasks in" select. calendar-sync writes scheduled, non-recurring tasks
into that calendar (etag-guarded PUT/DELETE/move) and pulls iCloud moves / renames / deletes back as `calendar-sync`
LWW upserts; the client triggers it ~5 s after task pushes. Eye: no P0 (P1-1 copy fixed), #56–#65 filed. Gauntlet +
sentry green, Lighthouse 100/100 · 98/100. db/005 applied by Cowork.
**Cowork owes:** deploy `calendar-connect` + `calendar-sync` (live code is still the read-only, broken-discovery v1).
**Not yet verified by Mark:** iCloud connect + two-way on the real Apple ID; on-device iPhone checks.

## Project rules

Global rules: council arc instrument
- **Originality gate:** no Structured.app (or other planner's) copy, iconography, naming or color scheme.
  Icons are drawn in-repo (`src/icons/`); fonts from Google Fonts only.
- **Sync contract is the API.** Any client (web now, Swift later) speaks only: outbox + `field_ts` + pull
  cursor over PostgREST (`docs/spec.md` §5). No client-specific server logic.
- **Only publishable keys in the client** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). All other
  secrets live in Edge Function secrets.
- **DDL channel:** `db/*.sql` is committed by Code and applied by Cowork; Code's Supabase MCP is read-only.
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
