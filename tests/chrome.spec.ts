// Arc 2 slice 3 — floating chrome: header fade, pill tab bar + FAB on iPhone, segmented control on desktop,
// glyphs + keyword auto-suggest in quick-add and the editor.
import { test, expect, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { CAT, at, openApp, quickAdd, row, seedDay, seedTask } from './support/app'

const serious = async (page: Page) => (await new AxeBuilder({ page }).analyze()).violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))

test.describe('iPhone chrome', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'iphone-15', 'iPhone chrome'))

  test('tab bar and FAB float (fixed), do not overlap, keep ≥ 44px targets; header has no border', async ({ page, context }) => {
    await openApp(page, context, { seed: seedDay })
    const bar = page.getByTestId('tabbar')
    const fab = page.getByTestId('fab')
    expect(await bar.evaluate((el) => getComputedStyle(el).position)).toBe('fixed')
    expect(await fab.evaluate((el) => getComputedStyle(el).position)).toBe('fixed')
    const b = (await bar.boundingBox())!
    const f = (await fab.boundingBox())!
    expect(b.x + b.width).toBeLessThanOrEqual(f.x) // side by side, no overlap
    expect(f.width).toBeGreaterThanOrEqual(56)
    for (const t of await bar.getByRole('tab').all()) {
      const box = (await t.boundingBox())!
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
    await expect(bar.getByRole('tab')).toHaveCount(4) // Inbox · Timeline · Week · Settings (Plan reserved, hidden)
    const hdr = page.getByTestId('header')
    expect(await hdr.evaluate((el) => getComputedStyle(el).borderBottomWidth)).toBe('0px')
    expect(await hdr.evaluate((el) => getComputedStyle(el).boxShadow)).toBe('none')
  })

  test('the last hour of the day is reachable beneath the bar', async ({ page, context }) => {
    let id = ''
    await openApp(page, context, { seed: (s) => (id = seedTask(s, { title: 'Wind down', start_at: at('22:00'), duration_min: 60, category_id: CAT.home }).id) })
    await page.getByTestId('timeline').evaluate((el) => (el.scrollTop = el.scrollHeight))
    const pill = page.locator(`[data-testid="block"][data-id="${id}"]`)
    await expect(pill).toBeVisible()
    const p = (await pill.boundingBox())!
    const b = (await page.getByTestId('tabbar').boundingBox())!
    expect(p.y + p.height).toBeLessThanOrEqual(b.y) // not covered by the floating bar
  })

  test('the timeline scrolls beneath the header and the bar (full-height scroller)', async ({ page, context }) => {
    await openApp(page, context, { seed: seedDay })
    const tl = (await page.getByTestId('timeline').boundingBox())!
    const vp = page.viewportSize()!
    expect(tl.y).toBeLessThanOrEqual(1)
    expect(tl.y + tl.height).toBeGreaterThanOrEqual(vp.height - 1)
  })

  test('FAB opens quick-add with focus in the field; adding closes it', async ({ page, context }) => {
    await openApp(page, context)
    await page.getByTestId('fab').click()
    await expect(page.getByTestId('quickadd-sheet')).toBeVisible()
    await expect(page.getByTestId('quickadd')).toBeFocused()
    await page.getByTestId('quickadd').fill('Dentist at 4pm')
    await expect(page.getByTestId('parse-icon')).toHaveAttribute('data-icon', 'health-pill')
    await page.getByTestId('quickadd').press('Enter')
    await expect(page.getByTestId('quickadd-sheet')).toHaveCount(0)
    await expect(page.locator('[data-testid="block"]', { hasText: 'Dentist' })).toBeVisible()
  })

  test('tabs switch views, and arrow keys move between tabs', async ({ page, context }) => {
    await openApp(page, context, { seed: seedDay })
    await page.getByTestId('tab-week').click()
    await expect(page.getByTestId('week-col').first()).toBeVisible()
    await page.getByTestId('tab-backlog').click()
    await expect(page.getByTestId('inbox')).toBeVisible()
    await page.getByTestId('tab-settings').click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await page.getByTestId('tab-settings').focus()
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByTestId('tab-week')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('tab-week')).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByTestId('timeline')).toBeVisible()
  })

  test('increased contrast / reduced transparency → an opaque bar, no blur', async ({ page, context }) => {
    await page.emulateMedia({ contrast: 'more' })
    await openApp(page, context)
    const bar = page.getByTestId('tabbar')
    expect(await bar.evaluate((el) => getComputedStyle(el).backdropFilter)).toBe('none')
    expect(await bar.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toMatch(/\/ 0\.8|, 0\.8\)/)
  })

  test('date strip picks a day; the title opens the month', async ({ page, context }) => {
    await openApp(page, context)
    const days = page.getByTestId('header').locator('.hdr-day')
    await expect(days).toHaveCount(7)
    const other = days.filter({ hasNot: page.locator('[aria-pressed="true"]') }).first()
    await days.nth(0).click()
    await expect(days.nth(0)).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: /open month/ }).click()
    await expect(page.getByTestId('month-day').first()).toBeVisible()
    void other
  })

  for (const theme of ['light', 'dark'] as const)
    test(`axe clean with the floating chrome (${theme})`, async ({ page, context }) => {
      await openApp(page, context, { seed: seedDay, theme })
      expect(await serious(page)).toEqual([])
      await page.getByTestId('fab').click()
      expect(await serious(page)).toEqual([])
    })

  for (const theme of ['light', 'dark'] as const)
    test(`evidence: iPhone chrome (${theme})`, async ({ page, context }) => {
      test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1 to refresh docs/evidence screenshots')
      await openApp(page, context, { seed: seedDay, theme })
      await page.getByTestId('timeline').evaluate((el) => (el.scrollTop = 10 * 66))
      await page.screenshot({ path: `docs/evidence/arc2-slice-3-iphone-day-${theme}.png` })
      await page.getByTestId('fab').click()
      await (await quickAdd(page)).fill('Gym every weekday at 7am')
      await page.screenshot({ path: `docs/evidence/arc2-slice-3-iphone-quickadd-${theme}.png` })
    })
})

test.describe('desktop chrome', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'desktop chrome'))

  test('the segmented pill switches views, with ← → cycling', async ({ page, context }) => {
    await openApp(page, context, { seed: seedDay })
    const seg = page.getByTestId('segmented')
    await seg.getByRole('tab', { name: 'Week' }).click()
    await expect(page.getByTestId('week-col')).toHaveCount(7)
    await seg.getByRole('tab', { name: 'Week' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(seg.getByRole('tab', { name: 'Month' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('month-day').first()).toBeVisible()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByTestId('timeline')).toBeVisible()
    await expect(page.getByTestId('tabbar')).toHaveCount(0)
    await expect(page.getByTestId('fab')).toHaveCount(0)
  })

  test('quick-add previews the suggested glyph; choosing another is remembered for that title', async ({ page, context }) => {
    await openApp(page, context)
    const qa = await quickAdd(page)
    await qa.fill('Guitar practice at 7pm')
    await expect(page.getByTestId('parse-icon')).toHaveAttribute('data-icon', 'creative-music')
    await page.getByTestId('parse-icon').click()
    await page.getByTestId('glyph-picker').getByRole('button', { name: 'rest-sofa' }).click()
    await expect(page.getByTestId('parse-icon')).toHaveAttribute('data-icon', 'rest-sofa')
    await qa.press('Enter')
    const pill = page.locator('[data-testid="block"]', { hasText: 'Guitar practice' })
    await pill.scrollIntoViewIfNeeded()
    await expect(pill.getByTestId('chip').locator('svg')).toHaveAttribute('data-icon', 'rest-sofa')
    expect(await page.evaluate(async () => (await (window as any).__optimo.db.settings.get('me')).data.iconOverrides)).toEqual({ 'guitar practice': 'rest-sofa' })
  })

  test('quick-add without #category takes the suggested one', async ({ page, context }) => {
    await openApp(page, context)
    const qa = await quickAdd(page)
    await qa.fill('Gym at 6pm')
    await expect(page.getByTestId('parse-category')).toHaveText('Health')
    await qa.press('Enter')
    const t = page.locator('[data-testid="block"]', { hasText: 'Gym' })
    await t.scrollIntoViewIfNeeded()
    expect((await row(page, (await t.getAttribute('data-id'))!)).category_id).toBe(CAT.health)
  })

  test('editor icon picker searches names + keywords and sets the pill glyph', async ({ page, context }) => {
    let ids: ReturnType<typeof seedDay>['ids']
    await openApp(page, context, { seed: (s) => (ids = seedDay(s).ids) })
    await page.evaluate((id) => (window as any).__optimo.ui.getState().set({ editingId: id }), ids!.plan)
    await page.getByTestId('sheet-icon').click()
    await page.getByTestId('glyph-picker').getByRole('searchbox').fill('passport')
    await expect(page.getByTestId('glyph-picker').getByRole('button')).toHaveCount(0)
    await page.getByTestId('glyph-picker').getByRole('searchbox').fill('flight')
    await page.getByTestId('glyph-picker').getByRole('button', { name: 'travel-plane' }).click()
    await page.keyboard.press('Escape')
    const pill = page.locator(`[data-testid="block"][data-id="${ids!.plan}"]`)
    await pill.scrollIntoViewIfNeeded()
    await expect(pill.getByTestId('chip').locator('svg')).toHaveAttribute('data-icon', 'travel-plane')
  })

  test('evidence: icon sheet', async ({ page, context }) => {
    test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1')
    await openApp(page, context)
    await page.evaluate(() => (window as any).__optimo.ui.getState().set({ view: 'icons' }))
    await page.screenshot({ path: 'docs/evidence/arc2-slice-3-icon-sheet-desktop.png', fullPage: true })
  })
})
