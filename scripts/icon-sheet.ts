// Render every glyph at 13 / 18 / 22 px, white on the salmon chip (--cat-2-chip), into docs/evidence/icons.png —
// the review sheet for the in-repo glyph set (design spec §6). Run: npx tsx scripts/icon-sheet.ts
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { ACTIVITY, CHROME, ICON_GROUPS } from '../src/icons/set'

const chip = /--cat-2-chip:\s*([^;]+);/.exec(readFileSync('src/styles/tokens.css', 'utf8'))![1]
const glyph = (body: string, px: number, box: number) =>
  `<span class="c" style="width:${box}px;height:${box}px"><svg viewBox="0 0 24 24" width="${px}" height="${px}" fill="#fff">${body}</svg></span>`
const row = (name: string, body: string) =>
  `<div class="r">${glyph(body, 13, 22)}${glyph(body, 18, 32)}${glyph(body, 22, 40)}<span class="n">${name}</span></div>`
const sections = [...ICON_GROUPS.map((g) => [g.label, g.icons] as const), ['Chrome', Object.keys(CHROME)] as const]
const html = `<!doctype html><meta charset="utf-8"><style>
  body{margin:24px;background:oklch(0.975 0.012 30);font:600 12px/1.3 system-ui,sans-serif;color:oklch(0.27 0.02 40)}
  h1{font-size:20px;margin:0 0 4px}h2{font-size:13px;margin:16px 0 6px;color:oklch(0.5 0.025 40)}
  .g{display:grid;grid-template-columns:repeat(4,1fr);gap:6px 16px}.r{display:flex;align-items:center;gap:8px}
  .c{display:inline-grid;place-items:center;border-radius:50%;background:${chip}}.n{margin-left:4px}
</style><h1>optimo glyph set — ${Object.keys(ACTIVITY).length} activity + ${Object.keys(CHROME).length} chrome · 13 / 18 / 22 px</h1>
${sections.map(([label, names]) => `<h2>${label}</h2><div class="g">${names.map((n) => row(n, (ACTIVITY as Record<string, string>)[n] ?? (CHROME as Record<string, string>)[n])).join('')}</div>`).join('')}`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 })
await page.setContent(html)
await page.screenshot({ path: 'docs/evidence/icons.png', fullPage: true })
await browser.close()
console.log('docs/evidence/icons.png')
