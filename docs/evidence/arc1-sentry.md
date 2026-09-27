# arc1 · sentry (security pass) — 2026-09-26 — GREEN

Scope: `git diff 181252b..HEAD` (kickoff → arc head), 109 text files (PNG/ZIP/lockfile excluded).

## Secrets scan (mandatory)
Patterns: Supabase secret/service-role keys, JWTs, Anthropic/GitHub/AWS tokens, PEM private keys, password literals.
- Hits: **1** — `sb_p…S4uX` in `.env.production`: the press **publishable** anon key, committed by design
  (docs/spec.md §4, CLAUDE.md "Only publishable keys in the client"). Not a secret.
- No service-role key, no JWT secret, no tokens, no private keys. `.env.test.local` (optional @real test user) is gitignored.
- Tracked env files: `.env.production` (publishable pair only), `.env.example` (blank).

## Dependency audit
`npm audit --omit=dev` → found 0 vulnerabilities.

## Threat sketch (one line each)
- Data: one user's tasks/categories/settings in `planner_*`, RLS `user_id = auth.uid()` on every table; sync log select-only.
- Flow: browser ⇄ PostgREST/Realtime with the user's JWT; nothing else leaves the device (NLP is on-device).
- Reach: magic-link sign-in; the anon key alone reads nothing (RLS). Blast radius of a stolen session = that user's planner rows.
- Test harness is fail-closed: hermetic specs abort any non-fake Supabase request; SWs are blocked in tests.
