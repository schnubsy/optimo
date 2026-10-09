// Arc 2 slice 2 (updated for the arc 6 spine) — the ring completes, the chip opens, no checkbox, free-time gaps,
// and axe in both themes.
import { test, expect, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { CAT, at, openApp, row, seedDay, seedTask } from './support/app'

const block = (page: Page, id: string) => page.locator(`[data-testid="block"][data-id="${id}"]`)
const setView = (page: Page, view: string) => page.evaluate((v) => (window as any).__optimo.ui.getState().set({ view: v, mobileTab: 'board' }), view)
const serious = async (page: Page) => (await new AxeBuilder({ page }).analyze()).violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))

test.describe('design system (arc 2 slice 2)', () => {
  // arc 6 (decision 2): the ring at the right completes; the chip on the spine opens the editor
  test('the ring completes and undoes; no checkbox anywhere on a row', async ({ page, context }) => {
    let ids: ReturnType<typeof seedDay>['ids']
    await openApp(page, context, { seed: (s) => (ids = seedDay(s).ids) })
    const st = block(page, ids!.standup)
    await st.scrollIntoViewIfNeeded()
    await expect(page.locator('[data-testid="block"] input[type="checkbox"]')).toHaveCount(0)
    const ring = st.getByTestId('ring')
    await expect(ring).toHaveAccessibleName('Mark Standup, platform team done')
    await ring.click()
    await expect(ring).toHaveAttribute('aria-pressed', 'true')
    await expect(st).toHaveAttribute('data-done', 'true')
    // the ring never opens the editor
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByTestId('toast').getByRole('button', { name: 'Undo' }).click()
    await expect(ring).toHaveAttribute('aria-pressed', 'false')
    expect((await row(page, ids!.standup)).completed_at).toBeNull()
  })

  test('X on a focused chip toggles done (desktop keyboard)', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'keyboard')
    let ids: ReturnType<typeof seedDay>['ids']
    await openApp(page, context, { seed: (s) => (ids = seedDay(s).ids), at: '12:00' })
    const g = block(page, ids!.guitar)
    await g.scrollIntoViewIfNeeded()
    await g.getByTestId('chip').focus()
    await page.keyboard.press('x')
    await expect.poll(async () => !!(await row(page, ids!.guitar)).completed_at).toBe(true)
    await page.keyboard.press('x')
    await expect.poll(async () => (await row(page, ids!.guitar)).completed_at).toBeNull()
  })

  test('free time: a sentence with the duration; the gap opens the wizard at its start for min(gap, default)', async ({ page, context }) => {
    await openApp(page, context, { seed: seedDay })
    // 16:45–18:00 is free (review ends 16:45, pickup at 18:00)
    const gap = page.locator('[data-testid="free-row"][data-start="1005"]')
    await gap.scrollIntoViewIfNeeded()
    await expect(gap.locator('.gap-say b')).toHaveText('1h 15m')
    await gap.getByTestId('free-add').click()
    await expect(page.getByTestId('wizard')).toHaveAttribute('data-start', '1005')
    await expect(page.getByTestId('wizard')).toHaveAttribute('data-duration', '30')
  })

  test('three short tasks within 30 min each get their own row on the spine (no overlap, no "+n")', async ({ page, context }) => {
    await openApp(page, context, {
      seed: (s) => {
        seedTask(s, { title: 'Pay rent', start_at: at('10:00'), duration_min: 10, category_id: CAT.home })
        seedTask(s, { title: 'Text Sam', start_at: at('10:10'), duration_min: 10, category_id: CAT.personal })
        seedTask(s, { title: 'Water plants', start_at: at('10:20'), duration_min: 10, category_id: CAT.home })
      },
    })
    await expect(page.getByTestId('cluster')).toHaveCount(0)
    const chips = page.locator('[data-testid="block"] [data-testid="chip"]')
    await expect(chips).toHaveCount(3)
    await chips.first().scrollIntoViewIfNeeded()
    const boxes = await Promise.all([0, 1, 2].map(async (i) => (await chips.nth(i).boundingBox())!))
    for (let i = 1; i < 3; i++) expect(boxes[i].y).toBeGreaterThanOrEqual(boxes[i - 1].y + boxes[i - 1].height)
    await page.locator('[data-testid="block"]').filter({ hasText: 'Water plants' }).getByTestId('chip').click()
    await expect(page.getByRole('dialog')).toBeVisible()
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
