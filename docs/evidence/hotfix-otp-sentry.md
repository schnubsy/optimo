# hotfix-otp · sentry (security pass) — 2026-09-27 — GREEN

Scope: `git diff main..arc/hotfix-otp-code` (22 files, PNGs excluded from the pattern scan).

## Secrets scan
Patterns: Supabase secret/service-role keys, JWTs, GitHub/Anthropic/AWS tokens, PEM private keys. Hits in the diff: **0**.
Built bundle: one key-shaped string — the press **publishable** key from `.env.production` (by design). The
`sb_secret_` literal in `dist/assets/index-*.js` is supabase-js's own prefix check (`e.startsWith('sb_secret_')`), not a key.

## Dependency audit
`npm audit --omit=dev` → found 0 vulnerabilities (no dependency changes this arc).

## Threat sketch
- Code guessing: GoTrue rate-limits `/verify`; the client adds no bypass. Wrong and expired both return one generic message.
- Account creation: `shouldCreateUser: false` — the client can't create users even if press sign-ups were re-enabled.
- No press Auth settings changed (RULE 2026-09-27).
