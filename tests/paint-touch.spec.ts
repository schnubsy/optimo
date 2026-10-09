// Arc 5a slice 4 — paint a block with real touch input. The iPhone 15 project is WebKit, and CDP's
// Input.dispatchTouchEvent (real touches with native scrolling: hold vs. swipe) is Chromium-only, so this file runs the
// same iPhone 15 device profile (viewport, touch, isMobile) in Chromium. The WebKit pointer path is in paint.spec.ts.
import { test, expect, type Page } from '@playwright/test'
import { at, openApp, seedDay } from './support/app'

test.use({ browserName: 'chromium' })

const untitled = (page: Page) =>
  page.evaluate(async () => {
    const rows = await (window as any).__optimo.db.tasks.toArray()
    return rows.filter((r: any) => r.title === '' && !r.deleted_at).map((r: any) => ({ id: r.id, start_at: r.start_at, duration_min: r.duration_min }))
  })
/** Minute → page coordinates on the empty right side of the spine, through the day's segment map (arc 6). */
async function slotPoint(page: Page, min: number) {
  const mins = Array.from({ length: 24 * 12 + 1 }, (_, i) => i * 5)
  const ys = await page.evaluate((ms) => {
    const o = (window as any).__optimo
    const map = o.maps.get(o.ui.getState().date)
    return ms.map((m) => map.minToY(m)) as number[]
  }, [...mins, min])
  await page.getByTestId('timeline').evaluate((el, y) => (el.scrollTop = y - el.clientHeight / 2), ys[ys.length - 1])
  const inner = (await page.locator('.tl-inner').boundingBox())!
  const yAt = (m: number) => {
    const i = Math.floor(m / 5)
    return ys[i] + ((m - i * 5) / 5) * (ys[Math.min(mins.length - 1, i + 1)] - ys[i])
  }
  return { x: inner.x + inner.width - 40, y: (m: number) => inner.y + yAt(m) }
}

test.describe('paint a block — real touch (Chromium, iPhone 15 profile)', () => {
  test('touch: long-press then drag paints; a quick swipe scrolls and paints nothing', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'iphone-15', 'touch path is the iPhone project')
    // real touch input (scroll vs. hold) needs CDP's Input.dispatchTouchEvent: Chromium with the iPhone 15 device profile
    await openApp(page, context, { seed: seedDay, at: '12:00' })
    const cdp = await context.newCDPSession(page)
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] })

    // quick swipe (no hold) over empty space: the timeline scrolls, nothing is painted
    const s = await slotPoint(page, 17 * 60 + 20)
    const tl = page.getByTestId('timeline')
    const top0 = await tl.evaluate((el) => el.scrollTop)
    await touch('touchStart', s.x, s.y(17 * 60 + 50))
    for (let i = 1; i <= 8; i++) await touch('touchMove', s.x, s.y(17 * 60 + 50) - i * 18)
    await touch('touchEnd', 0, 0)
    await expect.poll(() => tl.evaluate((el) => el.scrollTop)).toBeGreaterThan(top0 + 60)
    await page.waitForTimeout(600)
    expect(await untitled(page)).toHaveLength(0)
    await expect(page.getByTestId('paint-ghost')).toBeHidden()

    // long-press (> 400 ms) on 17:00, then drag to 17:30
    const p = await slotPoint(page, 17 * 60 + 20)
    await touch('touchStart', p.x, p.y(17 * 60 + 1))
    await page.waitForTimeout(650)
    const steps = 10
    for (let i = 1; i <= steps; i++) await touch('touchMove', p.x, p.y(17 * 60 + 1) + ((p.y(17 * 60 + 29) - p.y(17 * 60 + 1)) * i) / steps)
    await expect(page.getByTestId('paint-ghost').locator('.paint-label')).toHaveText('17:00–17:30')
    if (process.env.EVIDENCE) await page.screenshot({ path: `docs/evidence/arc5a-slice-4-ghost-${info.project.name}.png` })
    // the paint owns the finger: the timeline did not scroll while painting
    const topPainting = await tl.evaluate((el) => el.scrollTop)
    await touch('touchEnd', 0, 0)
    await expect.poll(() => untitled(page)).toHaveLength(1)
    const [t] = await untitled(page)
    expect(t.start_at).toBe(at('17:00'))
    expect(t.duration_min).toBe(30)
    expect(await tl.evaluate((el) => el.scrollTop)).toBe(topPainting)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    // tap the new (selected) block → the editor
    await page.locator(`[data-testid="block"][data-id="${t.id}"] [data-testid="chip"]`).tap()
    await expect(page.getByRole('dialog')).toBeVisible()
  })

})

