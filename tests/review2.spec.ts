// Arc 2 slice 7 — regression guards for the Eye's P0s (docs/evidence/arc2-slice-7-design-critique.md).
import { test, expect, type Page } from '@playwright/test'
import { CAT, at, openApp, quickAdd, seedDay, seedTask } from './support/app'

const box = (page: Page, sel: string) => page.locator(sel).first().boundingBox()
const overlap = (a: { x: number; width: number; y: number; height: number }, b: { x: number; width: number; y: number; height: number }) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

test.describe('Eye P0 guards (arc 2)', () => {
  for (const width of [1024, 1280])
    test(`A2-P0-1 desktop header: title, stats and now pill never overprint (${width}px)`, async ({ page, context }, info) => {
      test.skip(info.project.name !== 'desktop', 'desktop header')
      await page.setViewportSize({ width, height: 800 })
      await openApp(page, context, { seed: seedDay })
      const title = (await box(page, '.pane-title h1'))!
      const stats = (await box(page, '.pane-hdr .hdr-stats'))!
      const now = await box(page, '.hdr-now')
      const qa = (await box(page, '.pane-qa'))!
      expect(overlap(title, stats)).toBe(false)
      expect(overlap(stats, qa)).toBe(false)
      if (now) expect(overlap(now, stats) || overlap(now, title)).toBe(false)
      // the stats line keeps planned + free readable
      expect(stats.width).toBeGreaterThan(110)
      // …and nothing in it is clipped ("8h10" without its "free" is ambiguous)
      expect(await page.locator('.pane-hdr .hdr-stats').evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
      await expect(page.getByTestId('stat-planned')).toBeVisible()
      await expect(page.getByTestId('stat-free')).toBeVisible()
      // the title is shown whole, not clipped
      expect(await page.locator('.pane-title h1').evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    })

  test('A2-P0-2 a half-width overlap pill gives its width to the title (time moves to the accessible name)', async ({ page, context }) => {
    await openApp(page, context, {
      seed: (s) => {
        seedTask(s, { title: 'Standup, platform team', start_at: at('11:00'), duration_min: 30, category_id: CAT.meet })
        seedTask(s, { title: 'Dentist call back', start_at: at('11:05'), duration_min: 30, category_id: CAT.errand })
      },
    })
    const pill = page.locator('[data-testid="block"]', { hasText: 'Standup' })
    await pill.scrollIntoViewIfNeeded()
    const w = (await pill.boundingBox())!.width
    const time = pill.locator('.time')
    if (w <= 220) await expect(time).toBeHidden()
    const tt = pill.locator('.tt')
    // at least ~9 characters of the title are visible (was 2–3 before the fix)
    expect((await tt.boundingBox())!.width).toBeGreaterThan(Math.min(w - 60, 90))
    await expect(pill.locator('.blk-main')).toHaveAccessibleName(/Standup, platform team, 11:00/)
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

  test('A2-P0-4 the quick-add sheet keeps its whole parse row on screen and follows the keyboard inset', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'iphone-15', 'mobile sheet')
    await openApp(page, context)
    const field = await quickAdd(page)
    await field.fill('Gym every weekday at 7am for 45m #health !!')
    await expect(page.getByTestId('parse-row')).toContainText('every weekday')
    await page.waitForFunction(() => document.getAnimations().length === 0) // measure the settled sheet, not its slide-in
    const vp = page.viewportSize()!
    for (const chip of await page.getByTestId('parse-row').locator('b, span.f, span, button').all()) {
      const b = await chip.boundingBox()
      if (b) expect(b.y + b.height).toBeLessThanOrEqual(vp.height)
    }
    // a keyboard taking 300px: the sheet's wrapper lifts by exactly that inset
    await page.evaluate(() => (document.querySelector('.qa-wrap') as HTMLElement).style.setProperty('--kb-inset', '300px'))
    const sheet = (await page.getByTestId('quickadd-sheet').boundingBox())!
    expect(sheet.y + sheet.height).toBeLessThanOrEqual(vp.height - 300 + 2)
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
