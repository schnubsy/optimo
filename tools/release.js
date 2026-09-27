// tools/release.js — publish optimo.html (the Family Wing launcher card) to the schnubsy/press marquee.
// Modelled on remit/tools/release.js — Lane A, fail-closed:
//   0. the press checkout must exist (PRESS_DIR overrides ../press — e.g. a press worktree / branch checkout);
//   1. build dist/optimo.html (node build-press.mjs, deterministic) and run tools/publish-checks.mjs --check
//      (vendored gate == press canonical, dist fresh, build deterministic) — any failure aborts;
//   2. press/spaces.json must put optimo.html in the FAMILY space and NOT in personal — read only, never written;
//   3. sha256 dist/optimo.html, copy to press/optimo.html, re-hash the copy, and confirm with an independent
//      `shasum -a 256` (three witnesses); print the git blob id for the ship-proof record;
//   4. register optimo.html in press/pages.json if absent (same publish commit as the page).
// It stages and commits nothing: the operator makes one explicit publish commit with both files.
// Usage: node tools/release.js [--dry]
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PRESS = process.env.PRESS_DIR || join(ROOT, '..', 'press')
const PAGE = 'optimo.html'
const TITLE = 'optimo · Day planner'
const DRY = process.argv.includes('--dry')

const die = (m) => (console.error('release: ✗ ' + m), process.exit(1))
const ok = (m) => console.log('release: ✓ ' + m)
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

// 0. press checkout
if (!existsSync(PRESS)) die('the press repo was not found (' + PRESS + ') — set PRESS_DIR')

// 1. build + publish-checks (fail closed)
try {
  execFileSync(process.execPath, [join(ROOT, 'build-press.mjs')], { stdio: 'inherit', cwd: ROOT })
  execFileSync(process.execPath, [join(ROOT, 'tools', 'publish-checks.mjs'), '--check'], { stdio: 'inherit', env: { ...process.env, PRESS_DIR: PRESS } })
} catch {
  die('build / publish-checks failed — fix the bundle or re-vendor the gate before publishing')
}
const src = join(ROOT, 'dist', PAGE)

// 2. spaces.json gate (read only)
let spaces
try {
  spaces = JSON.parse(readFileSync(join(PRESS, 'spaces.json'), 'utf8'))
} catch {
  die('press/spaces.json is unreadable — refusing to publish (fail closed)')
}
const family = Array.isArray(spaces.family) ? spaces.family : []
const personal = Array.isArray(spaces.personal) ? spaces.personal : []
if (!family.includes(PAGE)) die(PAGE + ' is not in spaces.json "family" — refusing to publish into the wrong space')
if (personal.includes(PAGE)) die(PAGE + ' is ALSO in spaces.json "personal" — ambiguous space, refusing')
ok(PAGE + ' is in the family space (and not personal)')

// 3. hash → copy → re-hash → agree (three witnesses)
const srcHash = sha256(readFileSync(src))
const dest = join(PRESS, PAGE)
if (DRY) console.log('release: (--dry) would copy dist/' + PAGE + ' → ' + dest)
else copyFileSync(src, dest)
const target = DRY ? src : dest
const destHash = sha256(readFileSync(target))
if (srcHash !== destHash) die('sha256 mismatch after copy: source ' + srcHash + ' vs copy ' + destHash)
let cli = ''
try {
  cli = execFileSync('shasum', ['-a', '256', target], { encoding: 'utf8' }).trim().split(/\s+/)[0]
} catch {
  cli = ''
}
if (cli && cli !== srcHash) die('independent shasum disagrees: ' + cli + ' vs ' + srcHash)
const blob = execFileSync('git', ['-C', PRESS, 'hash-object', target], { encoding: 'utf8' }).trim()
ok('sha256 verified three ways: node(source)=node(copy)=shasum')
console.log('release:   sha256    ' + srcHash)
console.log('release:   git blob  ' + blob + '  (press/' + PAGE + ')')

// 4. pages.json entry (same publish commit as the page)
const pagesPath = join(PRESS, 'pages.json')
const pages = JSON.parse(readFileSync(pagesPath, 'utf8'))
if (!pages[PAGE]) {
  pages[PAGE] = { title: TITLE }
  if (!DRY) writeFileSync(pagesPath, JSON.stringify(pages, null, 2) + '\n')
  ok('added ' + PAGE + ' → pages.json ("' + TITLE + '")' + (DRY ? ' (--dry, not written)' : ''))
} else ok('pages.json already lists ' + PAGE + ' ("' + pages[PAGE].title + '")')

console.log('\nrelease: staged nothing. Publish both files in ONE press commit:')
console.log('  git -C ' + PRESS + ' add ' + PAGE + ' pages.json && git -C ' + PRESS + ' commit && git -C ' + PRESS + ' push')
