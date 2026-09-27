// Contrast table computed from src/styles/tokens.css (+ the a11y override layer) — every text pair ≥ 4.5:1 in both
// themes, all 8 category hues (design spec §12). Values are read from the CSS, never restated here.
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parse, wcagContrast, type Color } from 'culori'

const css = readFileSync('src/styles/tokens.css', 'utf8') + '\n' + readFileSync('src/styles/tokens-a11y.css', 'utf8')

/** Declarations of every block whose selector matches `pick`, in source order (later wins). */
function vars(pick: (selector: string) => boolean): Map<string, string> {
  const out = new Map<string, string>()
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const m of src.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim()
    if (sel.startsWith('@') || !pick(sel)) continue
    for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out.set(d[1], d[2].trim())
  }
  return out
}
const light = vars((s) => s === ':root')
const dark = new Map([...light, ...vars((s) => s === '[data-theme="dark"]')])

function resolve(v: Map<string, string>, value: string, depth = 0): string {
  if (depth > 10) throw new Error(`cycle at ${value}`)
  return value.replace(/var\((--[\w-]+)\)/g, (_, n) => resolve(v, v.get(n) ?? `MISSING(${n})`, depth + 1))
}
const color = (v: Map<string, string>, name: string): Color => {
  const c = parse(resolve(v, v.get(name)!))
  if (!c) throw new Error(`unparseable ${name}`)
  return c
}
const num = (v: Map<string, string>, name: string) => Number(resolve(v, v.get(name)!))
/** oklch(L, C·k, H) for category n — the same composition the CSS does. */
const cat = (v: Map<string, string>, n: number, l: string, cm: string): Color =>
  ({ mode: 'oklch', l: num(v, l), c: num(v, `--cat-${n}-c`) * num(v, cm), h: num(v, `--cat-${n}-h`) }) as Color

const themes = { light, dark } as const
const HUES = [1, 2, 3, 4, 5, 6, 7, 8]

describe.each(Object.entries(themes))('%s theme', (_name, v) => {
  it.each(HUES)('category %i: pill text on pill ≥ 4.5', (n) => {
    expect(wcagContrast(cat(v, n, '--pill-ink-l', '--pill-ink-cm'), cat(v, n, '--pill-l', '--pill-cm'))).toBeGreaterThanOrEqual(4.5)
  })
  it.each(HUES)('category %i: pill text on hovered pill ≥ 4.5', (n) => {
    expect(wcagContrast(cat(v, n, '--pill-ink-l', '--pill-ink-cm'), cat(v, n, '--pill-hover-l', '--pill-cm'))).toBeGreaterThanOrEqual(4.5)
  })
  it.each(HUES)('category %i: chip glyph on chip ≥ 4.5', (n) => {
    expect(wcagContrast(color(v, '--chip-glyph-color'), cat(v, n, '--chip-l', '--chip-cm'))).toBeGreaterThanOrEqual(4.5)
  })
  it.each([
    ['--ink-on-accent', '--accent'],
    ['--free-label-fg', '--free-label-bg'],
    ['--done-ink', '--done-fill'],
    ['--ink', '--canvas'],
    ['--ink-2', '--canvas'],
    ['--ink-2', '--panel'],
    ['--ink-2', '--surface'],
    ['--accent-ink', '--accent-tint'],
    ['--now-flag-fg', '--now-flag-bg'],
    ['--danger-ink', '--canvas'],
  ])('%s on %s ≥ 4.5', (fg, bg) => {
    expect(wcagContrast(color(v, fg), color(v, bg))).toBeGreaterThanOrEqual(4.5)
  })
})
