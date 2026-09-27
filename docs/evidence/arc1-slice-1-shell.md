# arc1 · slice 1 — shell + Pages deploy (2026-09-26)

## Gauntlet (`scripts/gauntlet.sh arc1-s1`, 20260926-192229) — GREEN
- 🟢 unit (vitest) — 1 test
- 🟢 build (vite)
- 🟢 playwright smoke + axe (desktop, iPhone 15) — 4 passed
- 🟢 lighthouse desktop perf=100 a11y=100
- 🟢 lighthouse mobile perf=100 a11y=100

## Ship proof
- Repo: https://github.com/schnubsy/optimo (public, per Mark 2026-09-26); Pages build_type=workflow.
- Before: `curl -s -o /dev/null -w '%{http_code}' https://schnubsy.github.io/optimo/` → `404`.
- Pushed `6a7ad01` to `origin/main` (fast-forward of the kickoff commit); `pages` run event=push,
  headSha=6a7ad01c730c6c2ebad15f9cdf4581949fb17be5, conclusion=success.
- After: `curl -s -H 'Cache-Control: no-cache' 'https://schnubsy.github.io/optimo/?v=…' | grep -o 'name="build" content="[0-9a-f]*"'`
  → `name="build" content="6a7ad01"` == pushed SHA prefix. HTTP 200.
