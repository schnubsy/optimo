// Arc 2 slice 7 — regression guards for the Eye's P0s (docs/evidence/arc2-slice-7-design-critique.md).
import { test, expect, type Page } from '@playwright/test'
import { CAT, at, openApp, quickAdd, seedDay, seedTask } from './support/app'

const box = (page: Page, sel: string) => page.locator(sel).first().boundingBox()
const overlap = (a: { x: number; width: number; y: number; height: number }, b: { x: number; width: number; y: number; height: number }) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

test.describe('Eye P0 guards (arc 2)', () => {
  for (const width of [1024, 1280])
    test(`A2-P0-1 desktop header: title, now pill and quick-add never overprint (${width}px)`, async ({ page, context }, info) => {
      test.skip(info.project.name !== 'desktop', 'desktop header')
      await page.setViewportSize({ width, height: 800 })
      await openApp(page, context, { seed: seedDay })
      const title = (await box(page, '.pane-title h1'))!
      const now = await box(page, '.hdr-now')
      const qa = (await box(page, '.pane-qa'))!
      expect(overlap(title, qa)).toBe(false)
      if (now) expect(overlap(now, title) || overlap(now, qa)).toBe(false)
      // arc 6: the stats line is gone from the header (decision 7)
      await expect(page.locator('.hdr-stats')).toHaveCount(0)
      // the title is shown whole, not clipped
      expect(await page.locator('.pane-title h1').evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    })

  test('A2-P0-2 concurrent tasks sit side by side on the spine; each title keeps room and the time is in the name', async ({ page, context }) => {
    await openApp(page, context, {
      seed: (s) => {
        seedTask(s, { title: 'Standup, platform team', start_at: at('11:00'), duration_min: 30, category_id: CAT.meet })
        seedTask(s, { title: 'Dentist call back', start_at: at('11:05'), duration_min: 30, category_id: CAT.errand })
      },
    })
    const pill = page.locator('[data-testid="block"]', { hasText: 'Standup' })
    const other = page.locator('[data-testid="block"]', { hasText: 'Dentist call back' })
    await pill.scrollIntoViewIfNeeded()
    // the second node takes the next column, 64 px right of the spine
    const a = (await pill.getByTestId('chip').boundingBox())!
    const b = (await other.getByTestId('chip').boundingBox())!
    expect(Math.round(b.x - a.x)).toBe(64)
    // at least ~9 characters of each title are visible
    expect((await pill.locator('.node-title').boundingBox())!.width).toBeGreaterThan(90)
    await expect(pill.getByTestId('chip')).toHaveAccessibleName(/Standup, platform team, 11:00/)
  })

  test('A2-P0-3 the floating bar actually blurs what scrolls beneath it', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'iphone-15', 'iPhone chrome')
    await openApp(page, context, { seed: seedDay })
    const f = await page.getByTestId('tabbar').evaluate((el) => {
      const c = getComputedStyle(el) as CSSStyleDeclaration & { webkitBackdropFilter?: string }
      return c.backdropFilter || c.webkitBackdropFilter || ''
    })
    expect(f).toContain('blur(20px)')
  })

  test('A2-P0-4 the create wizard keeps its parse chips on screen and Continue follows the keyboard inset', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'iphone-15', 'mobile sheet')
    await openApp(page, context)
    const field = await quickAdd(page)
    await field.fill('Gym every weekday at 7am for 45m #health !!')
    await expect(page.getByTestId('wizard-parse')).toContainText('every weekday')
    await page.waitForFunction(() => document.getAnimations().length === 0) // measure the settled sheet, not its slide-in
    const vp = page.viewportSize()!
    for (const chip of await page.getByTestId('wizard-parse').locator('span').all()) {
      const b = await chip.boundingBox()
      if (b) expect(b.y + b.height).toBeLessThanOrEqual(vp.height)
    }
    // a keyboard taking 300px: the floating Continue lifts by exactly that inset (arc 6: the wizard reuses keyboardInset)
    await page.evaluate(() => (document.querySelector('.wiz') as HTMLElement).style.setProperty('--kb-inset', '300px'))
    const cta = (await page.getByTestId('wizard-continue').boundingBox())!
    expect(cta.y + cta.height).toBeLessThanOrEqual(vp.height - 300 + 2)
    await expect(field).toBeInViewport()
  })

  test('evidence: after the P0 fixes', async ({ page, context }, info) => {
    test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1 to refresh docs/evidence screenshots')
    await openApp(page, context, {
      seed: (s) => {
        seedDay(s)
        seedTask(s, { title: 'Dentist call back', start_at: at('11:05'), duration_min: 30, category_id: CAT.errand })
      },
      theme: 'light',
    })
    const px = info.project.name === 'desktop' ? 72 : 66
    await page.getByTestId('timeline').evaluate((el, y) => (el.scrollTop = y), 9.5 * px)
    await page.screenshot({ path: `docs/evidence/arc2-slice-7-after-p0-${info.project.name}.png` })
    if (info.project.name === 'iphone-15') {
      const f = await quickAdd(page)
      await f.fill('Gym every weekday at 7am for 45m #health !!')
      await page.waitForFunction(() => document.getAnimations().length === 0)
      await page.screenshot({ path: 'docs/evidence/arc2-slice-7-after-p0-quickadd-iphone-15.png' })
    }
  })
})
