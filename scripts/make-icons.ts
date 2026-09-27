// Rasterise the brand mark (src/icons/brand.svg) into the PWA icon set under public/, using Playwright's
// Chromium (no native image deps). Run: npx tsx scripts/make-icons.ts
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const svg = readFileSync('src/icons/brand.svg', 'utf8')
const out = 'public/icons'
mkdirSync(out, { recursive: true })
copyFileSync('src/icons/brand.svg', 'public/favicon.svg')

// maskable: keep the mark inside the 80 % safe zone on a full-bleed background
const variants: { name: string; size: number; pad: number }[] = [
  { name: 'icon-192.png', size: 192, pad: 0 },
  { name: 'icon-512.png', size: 512, pad: 0 },
  { name: 'maskable-512.png', size: 512, pad: 0.12 },
  { name: 'apple-touch-icon.png', size: 180, pad: 0.06 },
]

const browser = await chromium.launch()
const page = await browser.newPage()
for (const v of variants) {
  const inner = Math.round(v.size * (1 - 2 * v.pad))
  await page.setViewportSize({ width: v.size, height: v.size })
  await page.setContent(
    `<html><body style="margin:0;background:#b54c3d;display:grid;place-items:center;width:${v.size}px;height:${v.size}px">
      <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`,
  )
  await page.screenshot({ path: `${out}/${v.name}`, omitBackground: false })
  console.log(`${out}/${v.name}`)
}
await browser.close()
