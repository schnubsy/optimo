// arc 6 slice 3 — the spine timeline (mockups 01 / 08 / 09): geometry, ring, drag + paint through the segment map.
import { test, expect, type Page } from '@playwright/test'
import { at, CAT, openApp, row, seedTask } from './support/app'

/** The mockup day: bookends 9:00 / 10:30 PM, 12 h clock. */
async function mockupDay(page: Page) {
  await page.evaluate(() => (window as any).__optimo.repo.updateSettings({ day_start: 540, day_end: 1350, clock24: false, theme: 'dark' }))
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByTestId('anchor').first()).toHaveAttribute('data-start', '540')
}
const settle = (page: Page) => page.waitForFunction(() => document.getAnimations().length === 0)
const box = async (page: Page, sel: string) => (await page.locator(sel).first().boundingBox())!

test.describe('arc 6 spine', () => {
  test('01 empty day: bookends on the spine, a compressed gap with 1:00 / 5:00 ticks and an Add Task pill', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'iphone-15', 'mockup geometry is the 402-wide phone')
    await page.setViewportSize({ width: 402, height: 874 })
    await openApp(page, context, { at: '08:00' })
    await mockupDay(page)
    await settle(page)
    const chip = await box(page, '[data-testid="anchor"][data-which="start"] [data-testid="anchor-chip"]')
    expect(Math.abs(chip.x + chip.width / 2 - 78)).toBeLessThanOrEqual(2)
    expect(chip.width).toBeCloseTo(56, 0)
    const ring = await box(page, '[data-testid="anchor"][data-which="start"] [data-testid="anchor-ring"]')
    expect(Math.abs(ring.x + ring.width / 2 - 362)).toBeLessThanOrEqual(2)
    await expect(page.locator('[data-testid="anchor"][data-which="start"]')).toContainText('Up')
    await expect(page.locator('[data-testid="anchor"][data-which="end"]')).toContainText('Lights out')
    const gap = page.getByTestId('free-row')
    await expect(gap).toHaveCount(1)
    await expect(gap).toHaveAttribute('data-len', String(13 * 60 + 29))
    expect((await gap.boundingBox())!.height).toBeCloseTo(120, 0)
    await expect(gap).toContainText('13h 29m')
    await expect(page.getByTestId('spine-dashed')).toHaveCount(1)
    const labels = await page.getByTestId('hour-label').allTextContents()
    expect(labels).toEqual(['9:00', '1:00', '5:00', '10:30'])
    // the pill opens the wizard at the gap start
    await gap.getByTestId('free-add').click()
    const w = await page.evaluate(() => (window as any).__optimo.ui.getState().wizard)
    expect(w.mode).toBe('timeline')
    expect(new Date(w.draft.start_at).getHours() * 60 + new Date(w.draft.start_at).getMinutes()).toBe(541)
  })

  test('08 a 90-min capsule: 180 px, labels 8:00 · 9:00 · 9:30 · 10:00 · 10:30, meta with the duration', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'iphone-15', 'mockup geometry is the 402-wide phone')
    await page.setViewportSize({ width: 402, height: 874 })
    let id = ''
    await openApp(page, context, { at: '08:00', seed: (s) => (id = seedTask(s, { title: 'Watch a Movie', start_at: at('20:00'), duration_min: 90, category_id: CAT.errand }).id) })
    await mockupDay(page)
    await settle(page)
    const blk = page.locator(`[data-testid="block"][data-id="${id}"]`)
    const cap = (await blk.getByTestId('chip').boundingBox())!
    expect(Math.abs(cap.height - 180)).toBeLessThanOrEqual(2)
    expect(Math.abs(cap.x + cap.width / 2 - 78)).toBeLessThanOrEqual(2)
    const ring = (await blk.getByTestId('ring').boundingBox())!
    expect(Math.abs(ring.x + ring.width / 2 - 362)).toBeLessThanOrEqual(2)
    await expect(blk).toContainText('8:00–9:30 PM (1 hr, 30 min)')
    const labels = await page.getByTestId('hour-label').allTextContents()
    expect(labels).toEqual(['9:00', '12:00', '3:00', '8:00', '9:00', '9:30', '10:00', '10:30'])
    await expect(page.getByTestId('free-row').nth(1)).toContainText('1h')
  })

  test('09 the ring completes: filled disc + strike; the chip opens the editor in one tap', async ({ page, context }) => {
    let id = ''
    await openApp(page, context, { at: '08:00', seed: (s) => (id = seedTask(s, { title: 'Watch a Movie', start_at: at('20:00'), duration_min: 90, category_id: CAT.errand }).id) })
    const blk = page.locator(`[data-testid="block"][data-id="${id}"]`)
    await blk.scrollIntoViewIfNeeded()
    await blk.getByTestId('ring').click()
    await expect(blk).toHaveAttribute('data-done', 'true')
    expect((await row(page, id)).completed_at).toBeTruthy()
    expect(await blk.locator('.node-title').evaluate((e) => getComputedStyle(e).textDecorationLine)).toBe('line-through')
    await blk.getByTestId('chip').click()
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(await page.evaluate(() => (window as any).__optimo.ui.getState().editingId)).toBe(id)
  })

  test('the morning bookend ring is a per-day tick in settings, never a task', async ({ page, context }) => {
    await openApp(page, context, { at: '08:00' })
    const n = await page.evaluate(() => (window as any).__optimo.db.tasks.count())
    await page.locator('[data-testid="anchor"][data-which="start"]').scrollIntoViewIfNeeded()
    await page.locator('[data-testid="anchor"][data-which="start"] [data-testid="anchor-ring"]').click()
    await expect(page.locator('[data-testid="anchor"][data-which="start"]')).toHaveClass(/done/)
    const done = await page.evaluate(async () => (await (window as any).__optimo.repo.getSettings()).bookend_done)
    expect(Object.values(done)).toEqual([{ start: true }])
    expect(await page.evaluate(() => (window as any).__optimo.db.tasks.count())).toBe(n)
  })

  test('bookend names live in Settings → Day; tapping a bookend opens it', async ({ page, context }) => {
    await openApp(page, context, { at: '08:00' })
    const start = page.locator('[data-testid="anchor"][data-which="start"]')
    await start.scrollIntoViewIfNeeded()
    await start.getByTestId('anchor-chip').click()
    await expect(page.getByTestId('set-day')).toBeVisible()
    const name = page.getByTestId('set-day-start-name')
    await expect(name).toHaveAttribute('placeholder', 'Up')
    await name.fill('Coffee first')
    await name.press('Enter')
    await expect.poll(async () => (await page.evaluate(() => (window as any).__optimo.repo.getSettings())).day_start_name).toBe('Coffee first')
    await page.evaluate(() => (window as any).__optimo.ui.getState().set({ view: 'day', mobileTab: 'board' }))
    await expect(page.locator('[data-testid="anchor"][data-which="start"]')).toContainText('Coffee first')
  })

  test('drag reschedules across a compressed gap to the minute the map says', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'mouse drag')
    let id = ''
    await openApp(page, context, { at: '08:00', seed: (s) => (id = seedTask(s, { title: 'Write report', start_at: at('09:30'), duration_min: 30, category_id: CAT.work }).id) })
    await page.evaluate(() => (window as any).__optimo.repo.updateSettings({ day_start: 540, day_end: 1350, snap: 15 }))
    await expect(page.getByTestId('anchor').first()).toHaveAttribute('data-start', '540')
    await settle(page)
    const chip = page.locator(`[data-testid="block"][data-id="${id}"] [data-testid="chip"]`)
    await chip.scrollIntoViewIfNeeded()
    const b = (await chip.boundingBox())!
    // target: the y the day's map gives 16:00 (inside the compressed 10:00 → 22:30 gap)
    const target = await page.evaluate(({ start }) => {
      const ys = [...document.querySelectorAll('[data-testid="free-row"]')].map((g) => ({ from: Number((g as HTMLElement).dataset.start), len: Number((g as HTMLElement).dataset.len), r: g.getBoundingClientRect() }))
      const g = ys.find((x) => x.from <= 960 && 960 < x.from + x.len)!
      return { y: g.r.top + ((960 - g.from) / g.len) * g.r.height, start }
    }, { start: 570 })
    const rowTop = (await page.locator(`[data-testid="block"][data-id="${id}"]`).boundingBox())!.y
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
    await page.mouse.down()
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + 10, { steps: 3 })
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + (target.y - rowTop), { steps: 12 })
    await page.mouse.up()
    await expect.poll(async () => new Date((await row(page, id)).start_at).getHours()).toBe(16)
    const t = new Date((await row(page, id)).start_at)
    expect(Math.abs(t.getHours() * 60 + t.getMinutes() - 960)).toBeLessThanOrEqual(15)
  })

  test('paint on a compressed gap creates a block at the painted minute', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'mouse paint')
    await openApp(page, context, { at: '08:00' })
    await page.evaluate(() => (window as any).__optimo.repo.updateSettings({ day_start: 540, day_end: 1350, snap: 15 }))
    await expect(page.getByTestId('anchor').first()).toHaveAttribute('data-start', '540')
    await settle(page)
    const gap = page.getByTestId('free-row')
    await gap.scrollIntoViewIfNeeded()
    const g = (await gap.boundingBox())!
    const len = Number(await gap.getAttribute('data-len'))
    const yAt = (min: number) => g.y + ((min - 541) / len) * g.height
    const x = g.x + g.width - 30 // right of the sentence, over empty gap
    await page.mouse.move(x, yAt(14 * 60))
    await page.mouse.down()
    await page.mouse.move(x, yAt(14 * 60) + 6, { steps: 2 })
    await page.mouse.move(x, yAt(16 * 60), { steps: 8 })
    await page.mouse.up()
    const painted = () => page.evaluate(async () => ((await (window as any).__optimo.db.tasks.toArray()) as any[]).find((t) => t.title === '' && t.start_at) ?? null)
    await expect.poll(painted).not.toBeNull()
    const t = (await painted()) as { start_at: string; duration_min: number }
    const s = new Date(t.start_at)
    const startMin = s.getHours() * 60 + s.getMinutes()
    // the compressed run packs ~6.7 min per px: the paint lands within one snap of the painted minute
    expect(Math.abs(startMin - 14 * 60)).toBeLessThanOrEqual(15)
    expect(Math.abs(startMin + t.duration_min - 16 * 60)).toBeLessThanOrEqual(15)
  })

  test('evidence: spine empty / block / done (402×874 dark)', async ({ page, context }, info) => {
    test.skip(!process.env.EVIDENCE || info.project.name !== 'iphone-15', 'set EVIDENCE=1')
    await page.setViewportSize({ width: 402, height: 874 })
    await openApp(page, context, { at: '08:00' })
    await mockupDay(page)
    await settle(page)
    await page.screenshot({ path: 'docs/evidence/arc6-slice-3-spine-empty.png' })
    const id = await page.evaluate(async (s) => (await (window as any).__optimo.repo.createTask({ title: 'Watch a Movie', start_at: s, duration_min: 90, category_id: '0190a000-0000-7000-8000-000000000006' })).id, at('20:00'))
    await expect(page.locator(`[data-testid="block"][data-id="${id}"]`)).toBeVisible()
    await settle(page)
    await page.screenshot({ path: 'docs/evidence/arc6-slice-3-spine-block.png' })
    await page.locator('[data-testid="anchor"][data-which="start"] [data-testid="anchor-ring"]').click()
    await settle(page)
    await page.screenshot({ path: 'docs/evidence/arc6-slice-3-spine-done.png' })
  })
})
