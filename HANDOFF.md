# HANDOFF — optimo

## Current state
Just scaffolded (2026-09-26). Control files, `docs/spec.md`, `db/001_planner.sql`, gauntlet + smoke
spec, Eye LITE design pack (`docs/design/2026-09-26-lite/`, Switchboard adopted). No app code, no
GitHub remote yet.

## Shipped this arc
- Kickoff scaffold; local git repo with commit `chore: project kickoff`.
- Supabase migration `db/001_planner.sql` written (applied state: see ARC.md decisions block).

## Open / blockers
- GitHub repo `schnubsy/optimo` not yet created (slice 1 of arc 1 does it).
- Supabase Auth: site URL + redirect for `https://schnubsy.github.io/optimo/` must be added in the
  dashboard (Mark's manual step below) before magic-link sign-in works on the live URL.
- Calendar provider (Google vs iCloud) — decided at the arc-2 checkpoint, not needed for v0.1.

## Exact next steps
1. Run arc 1 (v0.1 baseline) from `ARC.md` — 6 slices, back-to-back.
2. Arc 2 checkpoint: calendar provider(s), push notifications, marquee portal link card.
3. Arc 3: AI planning layer (intent → plan), challenge-style prompting.

## Mark's manual steps
1. Supabase dashboard → Authentication → URL Configuration: add
   `https://schnubsy.github.io/optimo/` to Site URL / Redirect URLs (also `http://localhost:5173/optimo/` for dev).
   Postcondition: magic-link email lands and the redirect returns to the app signed in.
