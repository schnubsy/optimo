# optimo — Claude instructions

## Purpose

Personal daily-planner web app (responsive PWA, desktop + iPhone) in the Structured.app category:
day timeline + inbox + week/month views, drag-and-drop time-blocking, categories/icons/priorities,
recurrence, focus mode, offline-first with sync. Later arcs: calendar sync, then an AI layer that turns
written intent into a scheduled day. Single user (Mark). Everything original — no proprietary look, copy or icons.

## Stack & how to run

- **TypeScript · React 18 · Vite · CSS variables** (tokens: `src/styles/tokens.css`, Eye "Switchboard").
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

**v0.1 baseline shipped (arc 1, 2026-09-26)** — live at https://schnubsy.github.io/optimo/ (public repo schnubsy/optimo).
Day timeline (drag/resize/free rows/undo/keyboard), inbox + NLP command line + Place, categories + 57 in-repo icons,
recurrence with per-occurrence exceptions, week/month/focus/settings, in-app reminders, JSON export/import,
Dexie outbox + field-level LWW sync over PostgREST/Realtime, magic-link auth, offline PWA, 5k-task perf budgets.
Gauntlet: 73 unit + 56 Playwright (desktop + iPhone 15, axe) + Lighthouse 100/100 · 98/100. Tests are hermetic
(`tests/support/fakeSupabase.ts`); `tests/sync.real.spec.ts` runs against press only with `.env.test.local`.
Next: arc-2 checkpoint (calendar provider, web push, marquee link card); 🟡 design snags = GitHub issues #1–#12.

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
