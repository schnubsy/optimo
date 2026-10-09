// Arc 5a slice 4 — paint a block by dragging on empty timeline: mouse press-drag, touch long-press-then-drag (a quick
// swipe still scrolls), keyboard slot cursor, axe, and frame-time evidence for the transform-only ghost.
import { writeFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { at, openApp, seedDay } from './support/app'
import { buildSeed } from '../scripts/seed'

const untitled = (page: Page) =>
  page.evaluate(async () => {
    const rows = await (window as any).__optimo.db.tasks.toArray()
    return rows.filter((r: any) => r.title === '' && !r.deleted_at).map((r: any) => ({ id: r.id, start_at: r.start_at, duration_min: r.duration_min }))
  })

/** The open day's segment map, sampled: minute → y inside .tl-inner (arc 6: the only conversion on the spine). */
const mapYs = (page: Page, mins: number[]) =>
  page.evaluate((ms) => {
    const o = (window as any).__optimo
    const map = o.maps.get(o.ui.getState().date)
    return Object.fromEntries(ms.map((m) => [m, map.minToY(m)])) as Record<number, number>
  }, mins)

/** Scroll so `min` sits mid-viewport, then return page coordinates of minutes on the empty right side of the spine. */
async function slotPoint(page: Page, min: number) {
  const mins = Array.from({ length: 24 * 12 + 1 }, (_, i) => i * 5)
  const ys = await mapYs(page, [...mins, min])
  await page.getByTestId('timeline').evaluate((el, y) => (el.scrollTop = y - el.clientHeight / 2), ys[min])
  const inner = (await page.locator('.tl-inner').boundingBox())!
  const yAt = (m: number) => {
    const a = Math.floor(m / 5) * 5
    const b = Math.min(1440, a + 5)
    return ys[a] + ((m - a) / 5) * (ys[b] - ys[a])
  }
  return { x: inner.x + inner.width - 40, y: (m: number) => inner.y + yAt(m) }
}

test.describe('paint a block', () => {
  test('mouse: press-drag on empty space paints exactly that span; a click on the new block opens the editor', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'mouse path is desktop')
    const { errors } = await openApp(page, context, { seed: seedDay, at: '12:00' })
    // 16:45–18:00 is free in the seeded day; paint 17:00 → 17:45
    const p = await slotPoint(page, 17 * 60 + 20)
    await page.mouse.move(p.x, p.y(17 * 60 + 2))
    await page.mouse.down()
    for (let i = 1; i <= 12; i++) await page.mouse.move(p.x, p.y(17 * 60 + 2) + ((p.y(17 * 60 + 43) - p.y(17 * 60 + 2)) * i) / 12)
    const ghost = page.getByTestId('paint-ghost')
    await expect(ghost).toBeVisible()
    await expect(ghost.locator('.paint-label')).toHaveText('17:00–17:45')
    // transforms only: the ghost never gets top/height
    const style = await ghost.evaluate((el) => ({ t: (el as HTMLElement).style.transform, top: (el as HTMLElement).style.top, h: (el as HTMLElement).style.height }))
    expect(style.t).toMatch(/^translate3d/)
    expect(style.top + style.h).toBe('')
    if (process.env.EVIDENCE) await page.screenshot({ path: `docs/evidence/arc5a-slice-4-ghost-${info.project.name}.png` })
    await page.mouse.up()
    await expect(ghost).toBeHidden()

    await expect.poll(() => untitled(page)).toHaveLength(1)
    const [t] = await untitled(page)
    expect(t.start_at).toBe(at('17:00'))
    expect(t.duration_min).toBe(45)
    // the release did not also run click-to-create
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByTestId('toast')).toContainText('Untitled block added')
    const blk = page.locator(`[data-testid="block"][data-id="${t.id}"]`)
    await expect(blk).toHaveAttribute('data-selected', 'true')
    await expect(blk.locator('.node-title')).toHaveText('Untitled')
    await blk.getByTestId('chip').click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByTestId('wizard')).toHaveAttribute('data-start', String(17 * 60))
    expect(errors).toEqual([])
  })

  test('mouse: dragging upward paints above the press point; a plain click still creates a draft', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'mouse path is desktop')
    await openApp(page, context, { seed: seedDay, at: '12:00' })
    const p = await slotPoint(page, 17 * 60 + 20)
    await page.mouse.move(p.x, p.y(17 * 60 + 50))
    await page.mouse.down()
    for (let i = 1; i <= 8; i++) await page.mouse.move(p.x, p.y(17 * 60 + 50) - ((p.y(17 * 60 + 50) - p.y(17 * 60 + 9)) * i) / 8)
    await expect(page.getByTestId('paint-ghost').locator('.paint-label')).toHaveText('17:10–17:50')
    await page.mouse.up()
    await expect.poll(() => untitled(page)).toHaveLength(1)
    const [t] = await untitled(page)
    expect(t.start_at).toBe(at('17:10'))
    expect(t.duration_min).toBe(40)

    // under the 4 px threshold it is a click: click-to-create (the create wizard, prefilled), no painted task
    await page.keyboard.press('Escape')
    const q = await slotPoint(page, 20 * 60 + 30)
    await page.mouse.click(q.x, q.y(20 * 60 + 35))
    await expect(page.getByTestId('wizard')).toHaveAttribute('data-start', String(20 * 60 + 30))
    expect(await untitled(page)).toHaveLength(1)
  })

  test('keyboard: focus the slot, ↑/↓ move, Enter starts, ↓ extends, Enter creates, Esc cancels; axe clean', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'keyboard path is desktop')
    const { errors } = await openApp(page, context, { seed: seedDay, at: '12:00' })
    const slot = page.getByTestId('empty-slot')
    await slot.focus()
    await expect(slot).toHaveAttribute('data-min', String(12 * 60))
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown')
    await expect(slot).toHaveAttribute('data-min', String(12 * 60 + 15))
    await expect(page.getByTestId('slot-live')).toHaveText('Empty slot 12:15')
    // Esc cancels a started block
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('paint-ghost')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('paint-ghost')).toBeHidden()
    expect(await untitled(page)).toHaveLength(0)

    await page.keyboard.press('Enter')
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowDown')
    await expect(page.getByTestId('paint-ghost').locator('.paint-label')).toHaveText('12:15–12:45')
    const scan = async () => (await new AxeBuilder({ page }).analyze()).violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))
    expect(await scan()).toEqual([])
    await page.keyboard.press('Enter')
    await expect.poll(() => untitled(page)).toHaveLength(1)
    const [t] = await untitled(page)
    expect(t.start_at).toBe(at('12:15'))
    expect(t.duration_min).toBe(30)
    // focus hands over to the new block; Enter opens its editor
    await expect(page.locator(`[data-testid="block"][data-id="${t.id}"] [data-testid="chip"]`)).toBeFocused()
    expect(await scan()).toEqual([])
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByTestId('wizard')).toHaveAttribute('data-start', String(12 * 60 + 15))
    expect(errors).toEqual([])
  })

  test('perf: painting over a 5k library holds the frame budget with transforms only', async ({ page, context, browserName }, info) => {
    test.skip(info.project.name !== 'desktop' || browserName !== 'chromium', 'frame budget is measured on desktop Chromium')
    test.setTimeout(120_000)
    await openApp(page, context, { at: '12:00' })
    await page.evaluate(async (rs) => {
      const o = (window as any).__optimo
      for (const r of rs) r._kind = o.repo.taskKind(r)
      await o.db.tasks.bulkPut(rs)
    }, buildSeed({ tasks: 5000, series: 200 }))
    await expect(page.getByTestId('block').first()).toBeVisible()
    // the library ends by 22:15: press on empty space at 22:20 and paint upward across the busy evening
    const p = await slotPoint(page, 21 * 60 + 30)
    const from = p.y(22 * 60 + 20)
    await page.mouse.move(p.x, from)
    await page.mouse.down()
    await page.mouse.move(p.x, from - 6)
    await expect(page.getByTestId('paint-ghost')).toBeVisible()
    await page.evaluate(() => {
      const w = window as any
      w.__frames = []
      w.__long = []
      w.__muts = 0
      new PerformanceObserver((l) => w.__long.push(...l.getEntries().map((e) => e.duration))).observe({ type: 'longtask', buffered: false })
      // DOM churn proxy for a React re-render storm: element insertions/removals inside the timeline while painting
      w.__mo = new MutationObserver((ms) => (w.__muts += ms.filter((m) => m.type === 'childList').length))
      w.__mo.observe(document.querySelector('.tl-inner')!, { childList: true, subtree: true })
      let last = performance.now()
      w.__run = true
      const tick = (t: number) => {
        w.__frames.push(t - last)
        last = t
        if (w.__run) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    const moves = 60
    for (let i = 1; i <= moves; i++) await page.mouse.move(p.x, from - 6 - i * 1.5)
    const r = await page.evaluate(() => {
      const w = window as any
      w.__run = false
      w.__mo.disconnect()
      const g = document.querySelector<HTMLElement>('[data-testid="paint-ghost"]')!
      return { frames: (w.__frames as number[]).slice(1), long: w.__long as number[], muts: w.__muts as number, transform: g.style.transform, top: g.style.top, height: g.style.height, fill: g.querySelector<HTMLElement>('.paint-fill')!.style.cssText }
    })
    await page.mouse.up()
    await expect.poll(() => untitled(page)).toHaveLength(1)
    const sorted = [...r.frames].sort((a, b) => a - b)
    const pct = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
    const out = {
      spec: 'tests/paint.spec.ts › perf',
      at: new Date().toISOString(),
      library: '5 000 tasks + 200 series',
      pointer_moves: moves,
      raf_frames: r.frames.length,
      frame_ms: { p50: +pct(0.5).toFixed(2), p95: +pct(0.95).toFixed(2), max: +Math.max(...r.frames).toFixed(2) },
      long_tasks_over_50ms: r.long.filter((d) => d > 50).length,
      timeline_dom_insertions_while_painting: r.muts,
      ghost_style: { transform: r.transform, top: r.top, height: r.height, fill: r.fill },
      budget: { p95_frame_ms: 20, long_tasks: 0 },
    }
    console.log(JSON.stringify(out, null, 2))
    if (process.env.EVIDENCE) writeFileSync('docs/evidence/arc5a-slice-4-paint-perf.json', JSON.stringify(out, null, 2) + '\n')
    expect(r.frames.length).toBeGreaterThan(10)
    expect(out.frame_ms.p95).toBeLessThanOrEqual(20)
    expect(out.long_tasks_over_50ms).toBe(0)
    expect(r.muts).toBe(0)
    expect(r.transform).toMatch(/^translate3d/)
    expect(r.top + r.height).toBe('')
    expect(r.fill).toMatch(/^transform: scaleY/)
  })
})

test.describe('paint a block — WebKit pointer path (iPhone 15)', () => {
  test('a touch pointer held 400 ms paints; one that moves first does not', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'iphone-15', 'iPhone project')
    await openApp(page, context, { seed: seedDay, at: '12:00' })
    const p = await slotPoint(page, 17 * 60 + 20)
    const send = (type: string, y: number, x = p.x) =>
      page.evaluate(([type, x, y]) => {
        const el = document.elementFromPoint(x as number, y as number) ?? document.querySelector('.tl-inner')!
        el.dispatchEvent(new PointerEvent(type as string, { bubbles: true, cancelable: true, composed: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x as number, clientY: y as number }))
      }, [type, x, y] as const)
    // moved 30 px before the hold: a scroll, no paint
    await send('pointerdown', p.y(17 * 60 + 1))
    await send('pointermove', p.y(17 * 60 + 1) + 30)
    await page.waitForTimeout(600)
    await send('pointerup', p.y(17 * 60 + 1) + 30)
    await expect(page.getByTestId('paint-ghost')).toBeHidden()
    expect(await untitled(page)).toHaveLength(0)
    // held, then dragged: 17:00–17:45
    await send('pointerdown', p.y(17 * 60 + 1))
    await page.waitForTimeout(600)
    await expect(page.getByTestId('paint-ghost')).toBeVisible()
    await send('pointermove', p.y(17 * 60 + 44))
    await expect(page.getByTestId('paint-ghost').locator('.paint-label')).toHaveText('17:00–17:45')
    await send('pointerup', p.y(17 * 60 + 44))
    await expect.poll(() => untitled(page)).toHaveLength(1)
    const [t] = await untitled(page)
    expect(t.start_at).toBe(at('17:00'))
    expect(t.duration_min).toBe(45)
  })
})
