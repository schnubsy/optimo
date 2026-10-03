# ai-planner slice 1 — housekeeping: Pages deploy filter

Workflow parse (ruby YAML): `on.push = {branches: [main], paths-ignore: [docs/**, **/*.md, ARC.md, HANDOFF.md]}` — valid YAML; actionlint not installed, so the schema check is the parse + GitHub semantics below.

GitHub semantics: with `paths-ignore`, a push runs the workflow unless **every** changed path matches an ignore pattern. Replayed against real commits (picomatch, dot:true — same glob dialect):

```
paths-ignore: ["docs/**","**/*.md","ARC.md","HANDOFF.md"]

31f7d10 docs: HANDOFF — snag train 2026-10 merged, shipped, launcher republished; manual steps renumbered
  ignored  HANDOFF.md
  ignored  docs/lessons.md
  → no deploy

f5c1b42 chore: arc close — snag train 2026-10 (stage, history, lessons, handoff, ARC truncated)
  ignored  ARC.md
  ignored  CLAUDE.md
  ignored  HANDOFF.md
  ignored  docs/history.md
  ignored  docs/lessons.md
  → no deploy

b6ba80e chore: tick slice 15 — snag-train-2026-10
  ignored  ARC.md
  → no deploy

135661c chore: pre-PR page-diff gate — green (untouched views ≤0.08%)
  ignored  docs/evidence/snag-train-2026-10-pagediff-quickadd-iphone-15-diff.png
  ignored  docs/evidence/snag-train-2026-10-pagediff-week-iphone-15-diff.png
  ignored  docs/evidence/snag-train-2026-10-pre-pr-page-diff.md
  DEPLOYS  scripts/page-diff-gate.mjs
  DEPLOYS  tests/pagediff.spec.ts
  → DEPLOY

```

Result: control-file / docs-only commits (HANDOFF, arc close, slice ticks) no longer deploy; any commit touching code still does. A merge to main is evaluated on the whole push diff, so an arc merge with code still ships.

CLAUDE.md "Current stage" now records snag train merged `e17b434` + live and arc 3 in progress (no "PR open").

## Gauntlet (20261003-001348) — GREEN
unit · build · press launcher + publish-checks · deno check+test · secret gate · Playwright desktop + iPhone 15 (axe) · Lighthouse desktop 100/100, mobile 98/100.

First run at 00:11 went red on three specs reaching for the 19:30 pill (the timeline sits at "now" after midnight and virtualises it away); `openApp({at})` now pins their clock (lessons 2026-10-02 [test]).
