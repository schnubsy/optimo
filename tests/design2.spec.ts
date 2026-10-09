// Arc 2 slice 2 — the FINAL design system: chip as the complete control, no checkbox, free-time gaps, "+n" cluster,
// category picker, and axe in both themes.
import { test, expect, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { CAT, at, openApp, row, seedDay, seedTask } from './support/app'

const block = (page: Page, id: string) => page.locator(`[data-testid="block"][data-id="${id}"]`)
const setView = (page: Page, view: string) => page.evaluate((v) => (window as any).__optimo.ui.getState().set({ view: v, mobileTab: 'board' }), view)
const serious = async (page: Page) => (await new AxeBuilder({ page }).analyze()).violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))

test.describe('design system (arc 2 slice 2)', () => {
  test('the chip completes and undoes; no checkbox anywhere in a pill', async ({ page, context }) => {
    let ids: ReturnType<typeof seedDay>['ids']
    await openApp(page, context, { seed: (s) => (ids = seedDay(s).ids) })
    const st = block(page, ids!.standup)
    await st.scrollIntoViewIfNeeded()
    await expect(page.locator('[data-testid="block"] input[type="checkbox"]')).toHaveCount(0)
    const chip = st.getByTestId('chip')
    await expect(chip).toHaveAccessibleName('Mark Standup, platform team done')
    await chip.click()
    await expect(chip).toHaveAttribute('aria-pressed', 'true')
    await expect(st).toHaveAttribute('data-done', 'true')
    // tapping the chip never opens the editor
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByTestId('toast').getByRole('button', { name: 'Undo' }).click()
    await expect(chip).toHaveAttribute('aria-pressed', 'false')
    expect((await row(page, ids!.standup)).completed_at).toBeNull()
  })

  test('X on a focused pill toggles done (desktop keyboard)', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'keyboard')
    let ids: ReturnType<typeof seedDay>['ids']
    await openApp(page, context, { seed: (s) => (ids = seedDay(s).ids), at: '12:00' })
    const g = block(page, ids!.guitar)
    await g.scrollIntoViewIfNeeded()
    await g.locator('.blk-main').focus()
    await page.keyboard.press('x')
    await expect.poll(async () => !!(await row(page, ids!.guitar)).completed_at).toBe(true)
    await page.keyboard.press('x')
    await expect.poll(async () => (await row(page, ids!.guitar)).completed_at).toBeNull()
  })

  test('free time: labelled gap; "+" creates at the gap start for min(gap, default)', async ({ page, context }) => {
    await openApp(page, context, { seed: seedDay })
    // 16:45–18:00 is free (review ends 16:45, pickup at 18:00)
    const gap = page.locator('[data-testid="free-row"][data-start="1005"]')
    await gap.scrollIntoViewIfNeeded()
    await expect(gap.locator('.free-label')).toHaveText('1h 15m free')
    await gap.getByTestId('free-add').click()
    // the create wizard opens prefilled (arc 6 slice 6)
    await expect(page.getByTestId('wizard')).toHaveAttribute('data-start', '1005')
    await expect(page.getByTestId('wizard')).toHaveAttribute('data-duration', '30')
  })

  test('three short pills within 30 min collapse to "+3" and expand to a list', async ({ page, context }) => {
    await openApp(page, context, {
      seed: (s) => {
        seedTask(s, { title: 'Pay rent', start_at: at('10:00'), duration_min: 10, category_id: CAT.home })
        seedTask(s, { title: 'Text Sam', start_at: at('10:10'), duration_min: 10, category_id: CAT.personal })
        seedTask(s, { title: 'Water plants', start_at: at('10:20'), duration_min: 10, category_id: CAT.home })
      },
    })
    const c = page.getByTestId('cluster')
    await c.scrollIntoViewIfNeeded()
    await expect(c.getByRole('button', { name: /3 short tasks/ })).toContainText('+3')
    await c.getByRole('button', { name: /3 short tasks/ }).click()
    await c.getByRole('button', { name: /Water plants/ }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByTestId('sheet-title')).toHaveValue('Water plants')
  })

  test('right-click on the chip opens the category picker; picking re-categorises', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'context menu is desktop; long-press is the touch path')
    let ids: ReturnType<typeof seedDay>['ids']
    await openApp(page, context, { seed: (s) => (ids = seedDay(s).ids) })
    const l = block(page, ids!.lunch)
    await l.scrollIntoViewIfNeeded()
    await l.getByTestId('chip').click({ button: 'right' })
    await l.getByRole('dialog', { name: /Category for/ }).getByRole('button', { name: 'Family' }).click()
    await expect.poll(async () => (await row(page, ids!.lunch)).category_id).toBe(CAT.family)
    await expect(l).toHaveClass(/cat-family/)
  })

  for (const theme of ['light', 'dark'] as const)
    test(`axe clean in ${theme}: day, inbox, week, month, settings, editor`, async ({ page, context }) => {
      let ids: ReturnType<typeof seedDay>['ids']
      await openApp(page, context, { seed: (s) => (ids = seedDay(s).ids), theme })
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      expect(await serious(page)).toEqual([])
      for (const v of ['week', 'month', 'settings']) {
        await setView(page, v)
        expect(await serious(page), v).toEqual([])
      }
      await setView(page, 'day')
      await page.evaluate(() => (window as any).__optimo.ui.getState().set({ mobileTab: 'backlog' }))
      expect(await serious(page), 'inbox').toEqual([])
      await page.evaluate(() => (window as any).__optimo.ui.getState().set({ mobileTab: 'board' }))
      await page.evaluate((id) => (window as any).__optimo.ui.getState().set({ editingId: id }), ids!.plan)
      await expect(page.getByRole('dialog')).toBeVisible()
      expect(await serious(page), 'editor').toEqual([])
    })

  for (const theme of ['light', 'dark'] as const)
    test(`evidence: day / inbox / week (${theme})`, async ({ page, context }, info) => {
      test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1 to refresh docs/evidence screenshots')
      await openApp(page, context, { seed: seedDay, theme })
      const px = await page.evaluate(() => (matchMedia('(max-width: 899px)').matches ? 66 : 72))
      await page.getByTestId('timeline').evaluate((el, y) => (el.scrollTop = y), 10.5 * px)
      await page.screenshot({ path: `docs/evidence/arc2-slice-2-day-${info.project.name}-${theme}.png` })
      if (info.project.name === 'iphone-15') {
        await page.getByTestId('tab-backlog').click()
        await page.screenshot({ path: `docs/evidence/arc2-slice-2-inbox-${info.project.name}-${theme}.png` })
      }
      await setView(page, 'week')
      await page.locator('.wbody').evaluate((el) => (el.scrollTop = 6.5 * 40))
      await page.screenshot({ path: `docs/evidence/arc2-slice-2-week-${info.project.name}-${theme}.png` })
    })
})
