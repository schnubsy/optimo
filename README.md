# optimo

Personal daily planner — one timeline for the day, an inbox for everything else, built by dragging
blocks into place. Web PWA (desktop + iPhone), offline-first, synced through Supabase. AI planning
layer to follow.

**Stack:** TypeScript · React · Vite · dexie · @dnd-kit · Supabase (`planner_*`) · GitHub Pages.

```bash
npm install && npm run dev      # http://localhost:5173/optimo/
npm test && npx playwright test # unit + smoke
scripts/gauntlet.sh             # full ship gate
```

Control files: `CLAUDE.md` · `HANDOFF.md` · `ARC.md`. Spec: `docs/spec.md`.
