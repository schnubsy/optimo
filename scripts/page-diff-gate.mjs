#!/usr/bin/env node
// Snag-train PRE-PR page-diff gate for optimo (a Pages SPA, so there is no single built-file/live-page pair):
//   PAGEDIFF=<dir> npx playwright test tests/pagediff.spec.ts   → <dir>/<view>-<project>-{branch,live}.png
//   node scripts/page-diff-gate.mjs <dir> [--touched day,week,...] [--threshold 2]
// Diffs each pair with press's tools/page-diff.mjs `diffPngs` (pixelmatch, threshold 0.1), writes
// <view>-<project>-diff.png, prints a table. 🔴 only when a view NOT in --touched exceeds the threshold
// (touched views are pre-justified layout changes). Exit 0 green · 2 red · 1 usage.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { createRequire } from 'node:module'

// pixelmatch + pngjs are press's devDependencies, not optimo's — resolve them from the press checkout
const PRESS = join(homedir(), 'Documents/code/press')
const { diffPngs } = await import(join(PRESS, 'tools/page-diff.mjs'))
const { PNG } = createRequire(join(PRESS, 'package.json'))('pngjs')
const argv = process.argv.slice(2)
const dir = argv[0]
if (!dir) { console.error('usage: node scripts/page-diff-gate.mjs <dir> [--touched a,b] [--threshold 2]'); process.exit(1) }
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d }
const touched = new Set(val('--touched', '').split(',').filter(Boolean))
const threshold = Number(val('--threshold', '2'))

let red = false
const rows = []
for (const f of readdirSync(dir).filter((f) => f.endsWith('-branch.png')).sort()) {
  const key = f.replace(/-branch\.png$/, '')
  const view = key.split('-')[0]
  const live = join(dir, `${key}-live.png`)
  const { pct, diff } = diffPngs(readFileSync(join(dir, f)), readFileSync(live))
  writeFileSync(join(dir, `${key}-diff.png`), PNG.sync.write(diff))
  const over = pct > threshold
  const isTouched = touched.has(view)
  const mark = !over ? '🟢' : isTouched ? '🟡 intentional' : '🔴'
  if (over && !isTouched) red = true
  rows.push(`| ${key} | ${pct.toFixed(2)}% | ${isTouched ? 'yes' : 'no'} | ${mark} |`)
}
console.log(`| view-viewport | diff | touched by slices 1–13 | gate (≤${threshold}%) |\n|---|---|---|---|\n${rows.join('\n')}`)
console.log(red ? 'RESULT: RED' : 'RESULT: GREEN')
process.exit(red ? 2 : 0)
