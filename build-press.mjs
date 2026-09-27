// build-press.mjs — optimo's Family Wing launcher card for the press marquee: src-press/optimo.html with the
// vendored family gate and the brand mark inlined → dist/optimo.html. Deterministic (no stamps, no dates): the same
// sources always produce the same bytes (tenants.json deterministic: true; publish-checks rebuilds and compares).
// Usage: node build-press.mjs   (after `vite build`, which empties dist/; kept out of `npm run build` so the Pages
// deploy of dist/ never ships it — the gauntlet and tools/release.js run it)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

export function buildPress() {
  const gate = read('src/vendor/family-gate.js').replace(/\s+$/, '')
  const icon = 'data:image/svg+xml,' + encodeURIComponent(read('src/icons/brand.svg').trim())
  return read('src-press/optimo.html')
    .replace('__FAMILY_GATE__', () => gate)
    .replace(/__ICON__/g, () => icon)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const html = buildPress()
  mkdirSync(join(ROOT, 'dist'), { recursive: true })
  writeFileSync(join(ROOT, 'dist', 'optimo.html'), html)
  console.log(`build-press: dist/optimo.html (${html.length} bytes)`)
}
