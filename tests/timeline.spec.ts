// Day timeline: create at slot, drag reschedules by the dragged delta, resize changes duration, complete toggles.
import { test, expect, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { commitWizard, openApp, row, seedDay } from './support/app'

/** y (px, inside .tl-inner) of a minute on the open day — read from the day's segment map (arc 6: the one conversion). */
const yOf = (page: Page, min: number) =>
  page.evaluate((m) => {
    const o = (window as any).__optimo
    return o.maps.get(o.ui.getState().date).minToY(m) as number
  }, min)
const block = (page: Page, id: string) => page.locator(`[data-testid="block"][data-id="${id}"]`)

async function dragBy(page: Page, from: { x: number; y: number }, dy: number) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  // move in steps so dnd-kit sees the activation distance, then the full delta
  for (let i = 1; i <= 10; i++) await page.mouse.move(from.x, from.y + (dy * i) / 10)
  await page.mouse.up()
}

test.describe('day timeline', () => {
  test('renders the day with free rows, overlap columns and the now line', async ({ page, context }) => {
    const { errors } = await openApp(page, context, { seed: seedDay })
    // virtualised: only rows near the viewport are mounted
    const y15 = await yOf(page, 15 * 60)
    await page.getByTestId('timeline').evaluate((el, y) => (el.scrollTop = y), y15)
    expect(await page.getByTestId('block').count()).toBeGreaterThanOrEqual(4)
    await expect(page.getByTestId('free-row').first()).toBeVisible()
    await expect(page.getByTestId('now-line')).toHaveCount(1)
    // 1:1 (16:00) and the PR review (16:15) overlap → side by side
    const a = await page.locator('[data-testid="block"]', { hasText: '1:1 with Dana' }).getByTestId('chip').boundingBox()
    const b = await page.locator('[data-testid="block"]', { hasText: 'Review pull request' }).getByTestId('chip').boundingBox()
    expect(a && b && Math.abs(a.x - b.x) > 20).toBeTruthy()
    expect(errors).toEqual([])
  })

  test('tap an empty slot creates a task at that time', async ({ page, context }) => {
    const { errors } = await openApp(page, context, { seed: seedDay })
    const tl = page.getByTestId('timeline')
    await tl.evaluate((el, y) => (el.scrollTop = y), (await yOf(page, 16 * 60)) - 40)
    // 17:00 sits inside the 16:45–18:00 free gap (compressed: its y comes from the map); click right of the sentence
    const inner = await page.locator('.tl-inner').boundingBox()
    await page.mouse.click(inner!.x + inner!.width - 40, inner!.y + (await yOf(page, 17 * 60)) + 1)
    // the create wizard opens prefilled with the slot (arc 6 slice 6)
    await expect(page.getByTestId('wizard')).toHaveAttribute('data-start', String(17 * 60))
    await page.getByTestId('wizard-title').fill('Stretch')
    await commitWizard(page)
    await expect(page.locator('[data-testid="block"]', { hasText: 'Stretch' })).toBeVisible()
    await expect(page.locator('[data-testid="block"]', { hasText: 'Stretch' })).toHaveAttribute('data-start', String(17 * 60))
    expect(errors).toEqual([])
  })

  test('drag reschedules by the dragged delta and keeps duration', async ({ page, context }) => {
    let ids: ReturnType<typeof seedDay>['ids']
    // pinned: in the small hours the timeline opens near 03:00 and a 13:00 pill sits on the auto-scroll edge
    const { errors } = await openApp(page, context, { seed: (s) => (ids = seedDay(s).ids), at: '12:00' })
    const lunch = block(page, ids!.lunch)
    await lunch.scrollIntoViewIfNeeded()
    const before = await row(page, ids!.lunch)
    const box = (await lunch.getByTestId('chip').boundingBox())!
    // 13:00 → 15:00: the pixel distance the day's map puts between them
    const dy = (await yOf(page, 15 * 60)) - (await yOf(page, 13 * 60))
    await dragBy(page, { x: box.x + box.width / 2, y: box.y + 8 }, dy)
    await expect.poll(async () => (await row(page, ids!.lunch)).start_at).not.toBe(before.start_at)
    const after = await row(page, ids!.lunch)
    expect((new Date(after.start_at).getTime() - new Date(before.start_at).getTime()) / 60000).toBe(120)
    expect(after.duration_min).toBe(60)
    await expect(page.getByTestId('toast')).toContainText('Moved')
    expect(errors).toEqual([])
  })

  test('resize changes duration only', async ({ page, context }) => {
    let ids: ReturnType<typeof seedDay>['ids']
    const { errors } = await openApp(page, context, { seed: (s) => (ids = seedDay(s).ids) })
    const px = 120 // 2 px/min inside a capsule: 30 min = 60 px = px / 2
    const plan = block(page, ids!.plan)
    await plan.scrollIntoViewIfNeeded()
    await plan.getByTestId('chip').focus()
    const handle = plan.getByTestId('resize-handle')
    await expect(handle).toBeVisible()
    const h = (await handle.boundingBox())!
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2)
    await page.mouse.down()
    for (let i = 1; i <= 6; i++) await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2 + (px / 2) * (i / 6))
    await page.mouse.up()
    await expect.poll(async () => (await row(page, ids!.plan)).duration_min).toBe(120)
    expect((await row(page, ids!.plan)).start_at).toBeTruthy()
    expect(errors).toEqual([])
  })

  test('resize persists: server row carries duration_min and survives reload', async ({ page, context }) => {
    let ids: ReturnType<typeof seedDay>['ids']
    const { server, errors } = await openApp(page, context, { seed: (s) => (ids = seedDay(s).ids) })
    const px = 120 // 2 px/min inside a capsule: 30 min = 60 px = px / 2
    const plan = block(page, ids!.plan)
    await plan.scrollIntoViewIfNeeded()
    await plan.getByTestId('chip').focus()
    const handle = plan.getByTestId('resize-handle')
    await expect(handle).toBeVisible()
    const h = (await handle.boundingBox())!
    const x = h.x + h.width / 2, y = h.y + h.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    for (let i = 1; i <= 6; i++) await page.mouse.move(x, y + (px / 2) * (i / 6))
    await page.mouse.up()
    await expect.poll(() => server.rows.planner_tasks.get(ids!.plan)?.duration_min).toBe(120)
    await page.reload()
    await expect(page.getByTestId('sync-badge')).toHaveAttribute('data-state', 'synced')
    await block(page, ids!.plan).scrollIntoViewIfNeeded()
    await expect(block(page, ids!.plan)).toHaveAttribute('data-duration', '120')
    expect(errors).toEqual([])
  })

  test('resize: a fast flick (move + release in one frame) still commits', async ({ page, context }) => {
    let ids: ReturnType<typeof seedDay>['ids']
    const { server } = await openApp(page, context, { seed: (s) => (ids = seedDay(s).ids) })
    const px = 120 // 2 px/min inside a capsule: 30 min = 60 px = px / 2
    const plan = block(page, ids!.plan)
    await plan.scrollIntoViewIfNeeded()
    await plan.getByTestId('chip').focus()
    await expect(plan.getByTestId('resize-handle')).toBeVisible()
    // touch-style: down, one move, up — dispatched synchronously, as a quick thumb flick delivers them
    await plan.getByTestId('resize-handle').evaluate((el, dy) => {
      const r = el.getBoundingClientRect()
      const x = r.x + r.width / 2, y = r.y + r.height / 2
      const ev = (type: string, cy: number) => new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: cy })
      el.dispatchEvent(ev('pointerdown', y))
      el.dispatchEvent(ev('pointermove', y + dy))
      el.dispatchEvent(ev('pointerup', y + dy))
    }, px / 2)
    await expect.poll(async () => (await row(page, ids!.plan)).duration_min).toBe(120)
    await expect.poll(() => server.rows.planner_tasks.get(ids!.plan)?.duration_min).toBe(120)
  })

  test('resize by keyboard: Shift+↓/↑ changes duration by 5 min, min 5 (desktop)', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'keyboard map is desktop')
    let ids: ReturnType<typeof seedDay>['ids']
    const { server } = await openApp(page, context, { seed: (s) => (ids = seedDay(s).ids) })
    const d = block(page, ids!.dentist)
    await d.scrollIntoViewIfNeeded()
    await d.getByTestId('chip').focus()
    const start = (await row(page, ids!.dentist)).start_at
    await page.keyboard.press('Shift+ArrowDown')
    await expect.poll(async () => (await row(page, ids!.dentist)).duration_min).toBe(20)
    for (const want of [15, 10, 5, 5]) {
      await page.keyboard.press('Shift+ArrowUp')
      await expect.poll(async () => (await row(page, ids!.dentist)).duration_min).toBe(want)
    }
    expect((await row(page, ids!.dentist)).start_at).toBe(start)
    await expect.poll(() => server.rows.planner_tasks.get(ids!.dentist)?.duration_min).toBe(5)
  })

  test('an open editor reflects a duration changed outside it', async ({ page, context }) => {
    let ids: ReturnType<typeof seedDay>['ids']
    await openApp(page, context, { seed: (s) => (ids = seedDay(s).ids) })
    await page.evaluate((id) => (window as any).__optimo.ui.getState().set({ editingId: id }), ids!.plan)
    await expect(page.getByTestId('wizard')).toHaveAttribute('data-duration', '90')
    await page.evaluate((id) => (window as any).__optimo.repo.updateTask(id, { duration_min: 120 }), ids!.plan)
    await expect(page.getByTestId('wizard')).toHaveAttribute('data-duration', '120')
  })

  test('complete toggles, with undo', async ({ page, context }) => {
    let ids: ReturnType<typeof seedDay>['ids']
    const { errors } = await openApp(page, context, { seed: (s) => (ids = seedDay(s).ids) })
    const st = block(page, ids!.standup)
    await st.scrollIntoViewIfNeeded()
    await st.getByRole('button', { name: /^Mark .* done$/ }).click()
    await expect(st).toHaveClass(/done/)
    await page.getByTestId('toast').getByRole('button', { name: 'Undo' }).click()
    await expect(st).not.toHaveClass(/done/)
    expect(errors).toEqual([])
  })

  test('keyboard: select, nudge 5 min, edit with Enter (desktop)', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'keyboard map is desktop')
    let ids: ReturnType<typeof seedDay>['ids']
    await openApp(page, context, { seed: (s) => (ids = seedDay(s).ids), at: '12:00' })
    const one = block(page, ids!.guitar)
    await one.scrollIntoViewIfNeeded()
    await one.getByTestId('chip').focus()
    const before = (await row(page, ids!.guitar)).start_at
    await page.keyboard.press('ArrowDown')
    await expect.poll(async () => (new Date((await row(page, ids!.guitar)).start_at).getTime() - new Date(before).getTime()) / 60000).toBe(5)
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('axe clean with a populated day and the editor open', async ({ page, context }) => {
    let ids: ReturnType<typeof seedDay>['ids']
    await openApp(page, context, { seed: (s) => (ids = seedDay(s).ids) })
    const scan = async () => {
      const r = await new AxeBuilder({ page }).analyze()
      return r.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))
    }
    expect(await scan()).toEqual([])
    const b = block(page, ids!.plan)
    await b.scrollIntoViewIfNeeded()
    await b.getByTestId('chip').click() // arc 6: one tap on the chip opens the editor
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(await scan()).toEqual([])
  })

  for (const theme of ['dark', 'light'] as const)
    test(`evidence screenshot (${theme})`, async ({ page, context }, info) => {
      test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1 to refresh docs/evidence screenshots')
      let ids: ReturnType<typeof seedDay>['ids']
      await openApp(page, context, { seed: (s) => (ids = seedDay(s).ids), theme })
      await block(page, ids!.plan).scrollIntoViewIfNeeded()
      await block(page, ids!.plan).getByTestId('chip').focus()
      await page.screenshot({ path: `docs/evidence/arc1-slice-3-timeline-${info.project.name}-${theme}.png` })
    })

  test('evidence: resize before/after (arc 2 slice 1)', async ({ page, context }, info) => {
    test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1 to refresh docs/evidence screenshots')
    let ids: ReturnType<typeof seedDay>['ids']
    await openApp(page, context, { seed: (s) => (ids = seedDay(s).ids), theme: 'light' })
    const px = 120
    const plan = block(page, ids!.plan)
    await plan.scrollIntoViewIfNeeded()
    await plan.getByTestId('chip').focus()
    await page.screenshot({ path: `docs/evidence/arc2-slice-1-resize-before-${info.project.name}.png` })
    await plan.getByTestId('resize-handle').evaluate((el, dy) => {
      const r = el.getBoundingClientRect()
      const x = r.x + r.width / 2, y = r.y + r.height / 2
      const ev = (type: string, cy: number) => new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: cy })
      el.dispatchEvent(ev('pointerdown', y))
      el.dispatchEvent(ev('pointermove', y + dy))
      el.dispatchEvent(ev('pointerup', y + dy))
    }, px / 2)
    await expect(plan).toHaveAttribute('data-duration', '120')
    await page.reload()
    await expect(page.getByTestId('sync-badge')).toHaveAttribute('data-state', 'synced')
    await block(page, ids!.plan).scrollIntoViewIfNeeded()
    await expect(block(page, ids!.plan)).toHaveAttribute('data-duration', '120')
    await page.screenshot({ path: `docs/evidence/arc2-slice-1-resize-after-reload-${info.project.name}.png` })
  })
})
