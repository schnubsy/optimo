// tools/publish-checks.mjs — optimo's own drift guard for the press launcher (access-framework §7). Three checks:
//   1. src/vendor/family-gate.js is byte-identical (git blob) to the canonical press/src/family-gate.js
//      (PRESS_DIR overrides ../press) — a drifted vendored gate fails the publish;
//   2. dist/optimo.html is FRESH: it equals a rebuild from src-press/ right now (catches hand-edits / stale dist);
//   3. the build is DETERMINISTIC: two builds produce the same bytes (tenants.json deterministic: true).
// Usage: node tools/publish-checks.mjs --check   (exit 1 on any failure)
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPress } from '../build-press.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PRESS = process.env.PRESS_DIR || join(ROOT, '..', 'press')
const blob = (buf) => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex')
let failed = false
const fail = (m) => ((failed = true), console.error('publish-checks: ✗ ' + m))
const ok = (m) => console.log('publish-checks: ✓ ' + m)

const vendored = join(ROOT, 'src/vendor/family-gate.js')
const canonical = join(PRESS, 'src/family-gate.js')
if (!existsSync(vendored)) fail('src/vendor/family-gate.js is missing')
else if (!existsSync(canonical)) fail(`canonical gate not found at ${canonical} (set PRESS_DIR) — refusing (fail closed)`)
else {
  const a = blob(readFileSync(vendored))
  const b = blob(readFileSync(canonical))
  if (a === b) ok(`vendored family-gate.js == press/src/family-gate.js (${a.slice(0, 8)})`)
  else fail(`vendored family-gate.js (${a.slice(0, 8)}) has DRIFTED from press (${b.slice(0, 8)}) — re-vendor: cp ${canonical} src/vendor/family-gate.js`)
}

const dist = join(ROOT, 'dist/optimo.html')
const first = buildPress()
const second = buildPress()
if (first !== second) fail('build-press is NOT deterministic (two builds differ)')
else ok(`build-press is deterministic (${blob(Buffer.from(first)).slice(0, 8)})`)
if (!existsSync(dist)) fail('dist/optimo.html not built — run: node build-press.mjs')
else if (readFileSync(dist, 'utf8') !== first) fail('dist/optimo.html is STALE or hand-edited — rebuild with: node build-press.mjs')
else ok('dist/optimo.html is fresh (== a rebuild from src-press/)')

process.exit(failed ? 1 : 0)
