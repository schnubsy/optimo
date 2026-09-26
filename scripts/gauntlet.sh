#!/usr/bin/env bash
# optimo gauntlet — the ship gate (skills/_shared/references/testing.md, Web).
# Runs: unit (vitest) → build → Playwright smoke (desktop + iPhone 15, axe inside) → Lighthouse budgets.
# Full logs → docs/evidence/; the caller reads only the ≤30-line summary printed at the end.
set -uo pipefail
cd "$(dirname "$0")/.."
ARC="${1:-gauntlet}"
EV="docs/evidence"; mkdir -p "$EV"
STAMP="$(date +%Y%m%d-%H%M%S)"
LOG="$EV/${ARC}-gauntlet-${STAMP}.log"
PORT="${PORT:-4173}"
BASE="/optimo/"
URL="http://localhost:${PORT}${BASE}"
status=0; summary=()

run() { # name, cmd...
  local name="$1"; shift
  echo "=== $name ===" >>"$LOG"
  if "$@" >>"$LOG" 2>&1; then summary+=("🟢 $name"); else summary+=("🔴 $name (see $LOG)"); status=1; fi
}

run "unit (vitest)"      npx vitest run --reporter=dot
run "build (vite)"       npm run build --silent

# preview server for Playwright + Lighthouse
npx vite preview --port "$PORT" --strictPort >>"$LOG" 2>&1 &
PREVIEW=$!
for i in $(seq 1 30); do curl -sf "$URL" >/dev/null && break; sleep 0.5; done

export GAUNTLET=1
run "playwright smoke + axe (desktop, iPhone 15)" npx playwright test --reporter=line

# Lighthouse budgets: performance ≥ 85, accessibility ≥ 90 (built page, both form factors)
lh() { # preset label
  local preset="$1" label="$2" out="$EV/${ARC}-lighthouse-${label}-${STAMP}.json"
  npx lighthouse "$URL" --quiet --chrome-flags="--headless --no-sandbox" --output=json --output-path="$out" \
      $( [ "$preset" = desktop ] && echo "--preset=desktop" ) >>"$LOG" 2>&1 || { summary+=("🔴 lighthouse $label failed to run"); status=1; return; }
  local perf a11y
  perf=$(node -e "const r=require('./$out');console.log(Math.round(r.categories.performance.score*100))")
  a11y=$(node -e "const r=require('./$out');console.log(Math.round(r.categories.accessibility.score*100))")
  if [ "$perf" -ge 85 ] && [ "$a11y" -ge 90 ]; then summary+=("🟢 lighthouse $label perf=$perf a11y=$a11y");
  else summary+=("🔴 lighthouse $label perf=$perf a11y=$a11y (budget 85/90)"); status=1; fi
}
lh desktop desktop
lh mobile mobile

kill $PREVIEW 2>/dev/null || true

echo; echo "GAUNTLET SUMMARY ($ARC, $STAMP)"; printf '%s\n' "${summary[@]}"; echo "log: $LOG"
[ $status -eq 0 ] && echo "RESULT: GREEN" || echo "RESULT: RED"
exit $status
