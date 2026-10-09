// Regression guards for the slice-7 design review P0s (docs/evidence/arc1-slice-7-design-critique.md).
import { test, expect, type Page } from '@playwright/test'
import { openApp, seedDay, quickAdd } from './support/app'

const setView = (page: Page, view: string) => page.evaluate((v) => (window as any).__optimo.ui.getState().set({ view: v, mobileTab: 'board' }), view)
/** The resolved --accent (selected state) as the browser serialises a background colour. */
const accent = (page: Page) =>
  page.evaluate(() => {
    const probe = document.createElement('i')
    probe.style.background = 'var(--accent)'
    document.body.append(probe)
    const c = getComputedStyle(probe).backgroundColor
    probe.remove()
    return c
  })
const bg = (el: Element) => getComputedStyle(el).backgroundColor

test.describe('design review P0 guards', () => {
  test('P0-1 settings segmented controls show the selected option', async ({ page, context }) => {
    await openApp(page, context)
    await setView(page, 'settings')
    const on = page.getByTestId('set-snap').getByRole('button', { name: '5 min', exact: true })
    const off = page.getByTestId('set-snap').getByRole('button', { name: '10 min', exact: true })
    await expect(on).toHaveAttribute('aria-pressed', 'true')
    expect(await on.evaluate(bg)).toBe(await accent(page))
    expect(await off.evaluate(bg)).not.toBe(await accent(page))
  })

  test('P0-2 editor priority / reminder / scope chips show the selected option', async ({ page, context }) => {
    let s: ReturnType<typeof seedDay>
    await openApp(page, context, { seed: (x) => (s = seedDay(x)) })
    const b = page.locator(`[data-testid="block"][data-id="${s!.ids.plan}"] .blk-main`)
    await b.scrollIntoViewIfNeeded()
    await b.click()
    await b.click()
    const high = page.getByRole('dialog').getByRole('button', { name: 'High' })
    await expect(high).toHaveAttribute('aria-pressed', 'true')
    expect(await high.evaluate(bg)).toBe(await accent(page))
    const r10 = page.getByRole('dialog').getByRole('button', { name: '0:10' })
    await r10.click()
    expect(await r10.evaluate(bg)).toBe(await accent(page))
  })

  test('P0-3 the sync badge is fully on screen in every desktop view, offline too', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop strip')
    await openApp(page, context, { seed: seedDay })
    await context.setOffline(true)
    await (await quickAdd(page)).fill('queued thing')
    await (await quickAdd(page)).press('Enter')
    for (const v of ['day', 'week', 'month', 'settings']) {
      await setView(page, v)
      const badge = page.getByTestId('sync-badge')
      await expect(badge).toContainText('queued')
      const box = (await badge.boundingBox())!
      expect(box.x + box.width, `${v}: badge right edge`).toBeLessThanOrEqual(1280)
    }
    await context.setOffline(false)
  })

  test('P0-4 mobile week shows readable columns with ellipsised titles', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'iphone-15', 'mobile week')
    await openApp(page, context, { seed: seedDay })
    await setView(page, 'week')
    const col = page.locator('[data-testid="week-col"]').first()
    expect((await col.boundingBox())!.width).toBeGreaterThanOrEqual(100)
    const tt = page.locator('.wblk .tt').first()
    await expect(tt).toBeVisible()
    expect(await tt.evaluate((el) => getComputedStyle(el).textOverflow)).toBe('ellipsis')
    // today is within the first visible three days
    const today = await page.evaluate(() => {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })
    const tb = (await page.locator(`[data-testid="week-col"][data-day="${today}"]`).boundingBox())!
    expect(tb.x).toBeGreaterThanOrEqual(0)
    expect(tb.x + tb.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1)
  })

  test('P0-5 the parse row shows a parsed duration even for all-day/recurring input', async ({ page, context }) => {
    await openApp(page, context)
    const f = await quickAdd(page)
    await f.fill('Gym every weekday for 1h #health !!')
    // desktop command line `1:00`; the iPhone wizard's chip `1 hr`
    if ((await f.getAttribute('data-testid')) === 'quickadd') await expect(page.getByTestId('parse-duration')).toHaveText('1:00')
    else await expect(page.getByTestId('wizard-parse-duration')).toHaveText('1 hr')
  })

  test('evidence: after-fix screenshots', async ({ page, context }, info) => {
    test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1')
    let s: ReturnType<typeof seedDay>
    await openApp(page, context, { seed: (x) => (s = seedDay(x)) })
    await setView(page, 'week')
    await page.locator('.wbody').evaluate((el) => (el.scrollTop = 6.5 * 40))
    await page.screenshot({ path: `docs/evidence/arc1-slice-7-week-${info.project.name}.png` })
    await setView(page, 'settings')
    await page.screenshot({ path: `docs/evidence/arc1-slice-7-settings-${info.project.name}.png` })
    await setView(page, 'day')
    const b = page.locator(`[data-testid="block"][data-id="${s!.ids.plan}"] .blk-main`)
    await b.scrollIntoViewIfNeeded()
    await b.click()
    await b.click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.screenshot({ path: `docs/evidence/arc1-slice-7-editor-${info.project.name}.png` })
  })
})

// arc 6 slice 1 — the measured 2026-10-09 mockup palette (docs/design/2026-10-09-mockups/mockups.md → Palette)
const token = (page: Page, name: string) =>
  page.evaluate((n) => {
    const probe = document.createElement('i')
    probe.style.background = `var(${n})`
    document.body.append(probe)
    const c = getComputedStyle(probe).backgroundColor
    probe.remove()
    return c
  }, name)
/** "rgb(r, g, b)" / "oklch(...)" → [r, g, b] via a canvas, so OKLCH tokens compare as sRGB channels. */
const rgb = (page: Page, css: string) =>
  page.evaluate((c) => {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 1
    const x = cv.getContext('2d')!
    x.fillStyle = c
    x.fillRect(0, 0, 1, 1)
    return [...x.getImageData(0, 0, 1, 1).data.slice(0, 3)]
  }, css)
const near = (got: number[], want: number[], tol = 4) => got.every((v, i) => Math.abs(v - want[i]) <= tol)

test.describe('arc 6 tokens', () => {
  test('dark: canvas #000, panel #1C1C1E, accent ≈ #EC9792; light mirrors with a warm canvas', async ({ page, context }) => {
    await openApp(page, context, { theme: 'dark' })
    expect(await rgb(page, await page.evaluate(() => getComputedStyle(document.querySelector('.app')!).backgroundColor))).toEqual([0, 0, 0])
    expect(await rgb(page, await token(page, '--canvas'))).toEqual([0, 0, 0])
    expect(near(await rgb(page, await token(page, '--panel')), [0x1c, 0x1c, 0x1e]), 'panel').toBe(true)
    expect(near(await rgb(page, await token(page, '--accent')), [0xec, 0x97, 0x92]), 'accent').toBe(true)
    expect(near(await rgb(page, await token(page, '--card')), [0x2c, 0x2c, 0x2e]), 'card').toBe(true)
    expect(near(await rgb(page, await token(page, '--node')), [0x37, 0x38, 0x39]), 'node').toBe(true)
    await page.evaluate(() => (window as any).__optimo.repo.updateSettings({ theme: 'light' }))
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    const canvas = await rgb(page, await token(page, '--canvas'))
    expect(canvas[0]).toBeGreaterThan(240) // warm white, never pure black or pure white
    expect(canvas[0]).toBeGreaterThan(canvas[2])
  })

  test('day + inbox are axe-clean in both themes', async ({ page, context }) => {
    const { AxeBuilder } = await import('@axe-core/playwright')
    await openApp(page, context, { seed: seedDay, at: '10:00' })
    for (const theme of ['dark', 'light'] as const) {
      await page.evaluate((t) => (window as any).__optimo.repo.updateSettings({ theme: t }), theme)
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      for (const tab of ['board', 'backlog'] as const) {
        await page.evaluate((m) => (window as any).__optimo.ui.getState().set({ view: 'day', mobileTab: m }), tab)
        await page.waitForFunction(() => document.getAnimations().length === 0)
        const v = (await new AxeBuilder({ page }).analyze()).violations.filter((x) => ['serious', 'critical'].includes(x.impact ?? ''))
        expect(v.map((x) => `${theme}/${tab}: ${x.id} ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
      }
    }
  })

  test('evidence: dark + light token swatches', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'one capture')
    await openApp(page, context)
    await page.evaluate(() => {
      const names = ['--canvas', '--panel', '--card', '--node', '--spine', '--ink', '--ink-3', '--accent', '--accent-tint', '--ink-on-accent']
      const col = (theme: string) =>
        `<div data-theme="${theme}" style="background:var(--canvas);color:var(--ink);padding:24px;font:600 14px var(--font-ui)"><h2 style="margin:0 0 12px">${theme}</h2>` +
        names.map((n) => `<div style="display:flex;align-items:center;gap:12px;margin:6px 0"><i style="width:56px;height:32px;border-radius:12px;background:var(${n});outline:1px solid var(--spine)"></i>${n}</div>`).join('') +
        ['work', 'meet', 'health', 'personal', 'errand', 'learn', 'family', 'home']
          .map((c) => `<span class="cat-${c}" style="display:inline-grid;place-items:center;width:40px;height:40px;margin:4px;border-radius:50%;background:var(--node);box-shadow:inset 0 0 0 2px var(--cat-glyph)"><i style="width:14px;height:14px;border-radius:50%;background:var(--cat-glyph)"></i></span>`)
          .join('') +
        '</div>'
      const o = document.createElement('div')
      o.id = 'swatches'
      o.style.cssText = 'position:fixed;inset:0;z-index:9999;display:grid;grid-template-columns:1fr 1fr'
      o.innerHTML = col('dark') + col('light')
      document.body.append(o)
    })
    await page.screenshot({ path: 'docs/evidence/arc6-slice-1-tokens.png' })
    // every chrome glyph (10 new + 3 restyled) at 18 / 24 / 13 px
    await page.evaluate(() => document.getElementById('swatches')?.remove())
    await page.evaluate(() => (window as any).__optimo.ui.getState().set({ view: 'icons', mobileTab: 'board' }))
    const sheets = page.getByTestId('icon-sheet')
    await expect(page.getByTestId('icon-sizes')).toHaveCount(23)
    await sheets.last().scrollIntoViewIfNeeded()
    await sheets.last().screenshot({ path: 'docs/evidence/arc6-slice-1-glyphs.png' })
  })
})
