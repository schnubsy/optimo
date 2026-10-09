// Week / month / focus / settings / recurrence end to end.
import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { addTask, openApp, row, seedDay, quickAdd } from './support/app'

// iPhone: `view: 'week'` is the collapsed day panel (arc 6 slice 4); going back to the day expands it again
const setView = async (page: Page, view: string) => {
  await page.evaluate((v) => (window as any).__optimo.ui.getState().set({ view: v, mobileTab: 'board', ...(v === 'day' ? { panel: 'day' } : {}) }), view)
  // iPhone: wait for the sheet to reach its detent and finish moving (it covers the overview while it slides)
  await page.waitForFunction((v) => {
    const sheet = document.querySelector<HTMLElement>('[data-testid="panel-sheet"]')
    if (sheet && v === 'week' && sheet.dataset.detent !== 'week') return false
    return document.getAnimations().length === 0
  }, view)
}
const serious = async (page: Page) => (await new AxeBuilder({ page }).analyze()).violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))
const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

test.describe('week, month, focus, settings', () => {
  test('week: 7 spine columns; drag a node to the next day keeps its time', async ({ page, context }) => {
    let s: ReturnType<typeof seedDay>
    const { errors } = await openApp(page, context, { seed: (x) => (s = seedDay(x)) })
    await setView(page, 'week')
    await expect(page.getByTestId('week-col')).toHaveCount(7)
    const todayCol = page.locator(`[data-testid="week-col"][data-day="${todayKey()}"]`)
    const cols = await page.getByTestId('week-col').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.day))
    const i = cols.indexOf(todayKey())
    // drag toward the neighbouring column (next day, or previous if today is the last column)
    const dir = i < 6 ? 1 : -1
    const target = page.locator(`[data-testid="week-col"][data-day="${cols[i + dir]}"]`)
    const blk = todayCol.locator(`[data-testid="week-block"][data-id="${s!.ids.lunch}"]`)
    await blk.scrollIntoViewIfNeeded()
    const b = (await blk.boundingBox())!
    const t = (await target.boundingBox())!
    const before = await row(page, s!.ids.lunch)
    await page.mouse.move(b.x + b.width / 2, b.y + 6)
    await page.mouse.down()
    for (let k = 1; k <= 12; k++) await page.mouse.move(b.x + b.width / 2 + (t.x + t.width / 2 - b.x - b.width / 2) * (k / 12), b.y + 6)
    await page.mouse.up()
    await expect.poll(async () => (await row(page, s!.ids.lunch)).start_at).not.toBe(before.start_at)
    const after = await row(page, s!.ids.lunch)
    expect((new Date(after.start_at).getTime() - new Date(before.start_at).getTime()) / 3600_000).toBe(24 * dir)
    expect(await serious(page)).toEqual([])
    expect(errors).toEqual([])
  })

  test('desktop week: 7 spine columns at 36 px/h; each spine runs first node → last node', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop Week view')
    let s: ReturnType<typeof seedDay>
    await openApp(page, context, { at: '09:00', seed: (x) => (s = seedDay(x)) })
    await page.getByTestId('segmented').getByRole('tab', { name: 'Week' }).click()
    await expect(page.getByTestId('week-col')).toHaveCount(7)
    await expect(page.getByTestId('week-spine')).toHaveCount(7)
    // lunch 13:00 and the migration plan 14:00: 60 min apart → 36 px apart
    const lunch = (await page.locator(`[data-testid="week-block"][data-id="${s!.ids.lunch}"]`).boundingBox())!
    const plan = (await page.locator(`[data-testid="week-block"][data-id="${s!.ids.plan}"]`).boundingBox())!
    expect(Math.abs(plan.y - lunch.y - 36)).toBeLessThanOrEqual(1)
    // 48 px discs; the 90 min plan is a 48-wide capsule 54 px tall (0.6 px/min)
    expect(Math.abs(lunch.width - 48)).toBeLessThanOrEqual(1)
    expect(Math.abs(plan.height - 54)).toBeLessThanOrEqual(1)
    // the map is registered for the drop maths and agrees with the layout
    const col = page.locator(`[data-testid="week-col"][data-day="${todayKey()}"]`)
    const spine = (await col.getByTestId('week-spine').boundingBox())!
    const nodes = col.locator('[data-testid="week-node"], [data-testid="week-block"]')
    const boxes = await nodes.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ c: r.top + r.height / 2 })))
    const cs = boxes.map((b) => b.c)
    expect(Math.abs(spine.y - Math.min(...cs))).toBeLessThanOrEqual(1)
    expect(Math.abs(spine.y + spine.height - Math.max(...cs))).toBeLessThanOrEqual(1)
    expect(Math.abs(spine.width - 3)).toBeLessThanOrEqual(0.5)
    if (process.env.EVIDENCE) {
      await page.evaluate(() => (window as any).__optimo.repo.updateSettings({ theme: 'dark' }))
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
      await page.screenshot({ path: 'docs/evidence/arc6-slice-4-week-desktop.png' })
    }
  })

  test('theme toggle persists across reload', async ({ page, context }) => {
    await openApp(page, context, { seed: seedDay })
    await setView(page, 'settings')
    await page.getByTestId('set-theme').getByRole('button', { name: 'Light' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await page.getByTestId('set-theme').getByRole('button', { name: 'Dark' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect.poll(() => page.evaluate(async () => (await (window as any).__optimo.db.settings.get('me'))?.data.theme)).toBe('dark')
    expect(await serious(page)).toEqual([])
  })

  test('recurrence: a weekday series materialises; completing one occurrence completes only that one', async ({ page, context }) => {
    await openApp(page, context)
    await (await quickAdd(page)).fill('Stand-up every day at 9:15am for 15m')
    // desktop command line's parse row, or the iPhone wizard's parse chips
    await expect(page.locator('[data-testid="parse-row"], [data-testid="wizard-parse"]')).toContainText('every day')
    await addTask(page, 'Stand-up every day at 9:15am for 15m')
    await setView(page, 'week')
    // the series starts today, so it fills today and the rest of this week
    const days = await page.getByTestId('week-col').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.day!))
    await expect(page.getByTestId('week-block').filter({ hasText: 'Stand-up' })).toHaveCount(days.filter((d) => d >= todayKey()).length)
    // desktop: the ‹ › week buttons; iPhone: the strip swipe (±7 days) — set the date directly
    const step = async (n: 1 | -1) => {
      const btn = page.getByRole('button', { name: n > 0 ? 'Next week' : 'Previous week' })
      if (await btn.isVisible()) await btn.click()
      else await page.evaluate((k) => { const u = (window as any).__optimo.ui; const d = new Date(`${u.getState().date}T12:00:00`); d.setDate(d.getDate() + 7 * k); u.getState().set({ date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }) }, n)
    }
    await step(1)
    await expect(page.getByTestId('week-block').filter({ hasText: 'Stand-up' })).toHaveCount(7)
    await step(-1)
    await setView(page, 'day')
    const blk = page.locator('[data-testid="block"]', { hasText: 'Stand-up' })
    await blk.scrollIntoViewIfNeeded()
    await expect(blk).toHaveAttribute('data-start', String(9 * 60 + 15))
    await blk.getByRole('button', { name: /^Mark .* done$/ }).click()
    await expect(blk).toHaveClass(/done/)
    await setView(page, 'week')
    await expect(page.locator('[data-testid="week-block"].done', { hasText: 'Stand-up' })).toHaveCount(1)
    expect(await page.evaluate(async () => (await (window as any).__optimo.db.exceptions.count()))).toBe(1)
  })

  test('month: dot density, tap jumps to the day', async ({ page, context }) => {
    await openApp(page, context, { seed: seedDay })
    await setView(page, 'month')
    const cell = page.locator('[data-testid="month-day"][data-count="10"]')
    await expect(cell).toHaveCount(1)
    await cell.click()
    await expect(page.getByTestId('timeline')).toBeVisible()
    expect(await serious(page)).toEqual([])
  })

  test('focus: timer runs, +5 extends, complete returns to the day', async ({ page, context }) => {
    let s: ReturnType<typeof seedDay>
    await openApp(page, context, { seed: (x) => (s = seedDay(x)) })
    await page.evaluate((id) => (window as any).__optimo.ui.getState().set({ view: 'focus', focusId: id }), s!.ids.plan)
    await expect(page.getByTestId('focus')).toBeVisible()
    const t0 = await page.getByTestId('focus-timer').textContent()
    await expect.poll(() => page.getByTestId('focus-timer').textContent(), { timeout: 3000 }).not.toBe(t0)
    await page.getByTestId('focus-plus5').click()
    await expect.poll(async () => (await row(page, s!.ids.plan)).duration_min).toBe(95)
    expect(await serious(page)).toEqual([])
    await page.getByTestId('focus-complete').click()
    await expect(page.getByTestId('focus')).toHaveCount(0)
    await expect.poll(async () => (await row(page, s!.ids.plan)).completed_at).not.toBeNull()
  })

  test('export downloads every table as JSON; import round-trips', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'download handling')
    await openApp(page, context, { seed: seedDay })
    await setView(page, 'settings')
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export').click()])
    const path = await dl.path()
    const json = JSON.parse(readFileSync(path, 'utf8'))
    expect(json.app).toBe('optimo')
    expect(json.tasks.length).toBe(14)
    expect(json.categories.length).toBe(8)
    // edit locally, then import the older file: newer local field survives (same LWW as sync)
    const id = json.tasks[0].id
    await page.evaluate((i) => (window as any).__optimo.repo.updateTask(i, { title: 'Renamed after export' }), id)
    await page.getByTestId('import').setInputFiles(path)
    await expect(page.getByTestId('toast')).toContainText('Imported 22 rows')
    expect((await row(page, id)).title).toBe('Renamed after export')
  })

  test('evidence screenshots', async ({ page, context }, info) => {
    test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1')
    let s: ReturnType<typeof seedDay>
    await openApp(page, context, { seed: (x) => (s = seedDay(x)) })
    await addTask(page, 'Stretch every day at 7:45am for 15m #health')
    await setView(page, 'week')
    await page.locator('.wbody').evaluate((el) => (el.scrollTop = 6.5 * 40))
    await page.screenshot({ path: `docs/evidence/arc1-slice-5-week-${info.project.name}.png` })
    await setView(page, 'month')
    await page.screenshot({ path: `docs/evidence/arc1-slice-5-month-${info.project.name}.png` })
    await page.evaluate((id) => (window as any).__optimo.ui.getState().set({ view: 'focus', focusId: id }), s!.ids.plan)
    await page.waitForTimeout(1100)
    await page.screenshot({ path: `docs/evidence/arc1-slice-5-focus-${info.project.name}.png` })
    await page.evaluate(() => (window as any).__optimo.ui.getState().set({ view: 'settings', focusId: null }))
    await page.screenshot({ path: `docs/evidence/arc1-slice-5-settings-${info.project.name}.png`, fullPage: true })
  })
})
