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
    await (await quickAdd(page)).fill('Gym every weekday for 1h #health !!')
    await expect(page.getByTestId('parse-duration')).toHaveText('1:00')
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
