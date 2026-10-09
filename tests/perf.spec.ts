// Perf budgets (docs/spec.md §2.9) against a 5 000-task + 200-series library:
// day view ready < 200 ms after data · inbox filter < 50 ms · 60 drag frames with no long task > 50 ms.
import { writeFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'
import { openApp } from './support/app'
import { buildSeed } from '../scripts/seed'

async function seedLibrary(page: Page) {
  const rows = buildSeed({ tasks: 5000, series: 200 })
  await page.evaluate(async (rs) => {
    const o = (window as any).__optimo
    for (const r of rs) r._kind = o.repo.taskKind(r)
    await o.db.tasks.bulkPut(rs)
    // arc 2: iCloud events share the timeline — 10 a day over the sync window (−7 d … +60 d)
    const evs = []
    const d0 = new Date()
    d0.setHours(0, 0, 0, 0)
    for (let day = -7; day < 60; day++)
      for (let k = 0; k < 10; k++) {
        const s = new Date(d0.getTime() + day * 86_400_000 + (7 * 60 + k * 75) * 60_000)
        evs.push({ id: `ev-${day}-${k}`, account_id: 'acc', calendar_href: '/home/', uid: `u-${day}-${k}`, title: `Event ${k}`, location: null, start_at: s.toISOString(), end_at: new Date(s.getTime() + 45 * 60_000).toISOString(), all_day: false, status: null, color: null, deleted_at: null })
      }
    await o.db.events.bulkPut(evs)
  }, rows)
  return rows.length
}
const lastMeasure = (page: Page, name: string) =>
  page.evaluate((n) => {
    const e = performance.getEntriesByName(n, 'measure')
    return e.length ? e[e.length - 1].duration : null
  }, name)

test.describe('performance at 5k tasks', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'budgets are measured in Chromium (long-task API)')
  test.setTimeout(120_000)

  test('day view, inbox filter and drag stay inside budget', async ({ page, context }, info) => {
    await openApp(page, context)
    const n = await seedLibrary(page)
    expect(n).toBe(5200)
    expect(await page.evaluate(() => (window as any).__optimo.db.events.count())).toBe(670)
    expect(await page.evaluate(() => (window as any).__optimo.db.tasks.count())).toBeGreaterThanOrEqual(5200)

    // day switches: measure data → paint for several days (cold queries each time)
    const day: number[] = []
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => performance.clearMeasures('optimo:day-ready'))
      await page.keyboard.press(i < 3 ? 'ArrowRight' : 'ArrowLeft')
      await expect.poll(() => lastMeasure(page, 'optimo:day-ready')).not.toBeNull()
      day.push((await lastMeasure(page, 'optimo:day-ready'))!)
    }
    const dayMax = Math.max(...day)
    const dayMed = [...day].sort((a, b) => a - b)[Math.floor(day.length / 2)]

    // inbox filter
    const inboxCount = await page.getByTestId('inbox').locator('.n').textContent()
    const filt: number[] = []
    for (const q of ['b', 'bu', 'budget', 'budget #1']) {
      await page.evaluate(() => performance.clearMeasures('optimo:filter'))
      await page.getByTestId('inbox-filter').fill(q)
      await expect.poll(() => lastMeasure(page, 'optimo:filter')).not.toBeNull()
      filt.push((await lastMeasure(page, 'optimo:filter'))!)
    }
    await page.getByTestId('inbox-filter').fill('')
    const filterMax = Math.max(...filt)

    // drag: 60 pointer frames on a block, watching for long tasks
    await page.keyboard.press('t')
    await page.evaluate(() => {
      ;(window as any).__long = []
      new PerformanceObserver((l) => (window as any).__long.push(...l.getEntries().map((e) => e.duration))).observe({ type: 'longtask', buffered: false })
    })
    const blk = page.getByTestId('block').first()
    await blk.scrollIntoViewIfNeeded()
    const b = (await blk.getByTestId('chip').boundingBox())!
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
    await page.mouse.down()
    const frames = await page.evaluate(() => {
      ;(window as any).__frames = 0
      ;(window as any).__ts = [] as number[]
      const tick = (t: number) => {
        ;(window as any).__frames++
        ;(window as any).__ts.push(t)
        if ((window as any).__frames < 1000) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
      return 0
    })
    let transformOnly = true
    for (let i = 1; i <= 60; i++) {
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + i * 3)
      if (i === 30) transformOnly = await page.locator('.node.grab').evaluate((el) => (el as HTMLElement).style.transform.startsWith('translate3d'))
    }
    await page.mouse.up()
    const long = (await page.evaluate(() => (window as any).__long as number[])).filter((d) => d > 50)
    const rafFrames = (await page.evaluate(() => (window as any).__frames)) - frames
    // arc 6: frame-time p95 while dragging on the spine (60 fps budget → ≤ 20 ms)
    const ts = await page.evaluate(() => (window as any).__ts as number[])
    const deltas = ts.slice(1).map((t, i) => t - ts[i]).sort((a, b) => a - b)
    const p95 = deltas.length ? deltas[Math.floor(deltas.length * 0.95)] : 0

    const table = [
      '| budget | measured | limit | result |',
      '|---|---|---|---|',
      `| day view ready after data (max of 6 day switches) | ${dayMax.toFixed(1)} ms | < 200 ms | ${dayMax < 200 ? '🟢' : '🔴'} |`,
      `| inbox filter → rendered (max of 4 queries over ${inboxCount?.trim()}) | ${filterMax.toFixed(1)} ms | < 50 ms | ${filterMax < 50 ? '🟢' : '🔴'} |`,
      `| day view ready after data (median of 6, arc 6 spine) | ${dayMed.toFixed(1)} ms | ≤ 50 ms | ${dayMed <= 50 ? '🟢' : '🔴'} |`,
      `| drag: 60 pointer moves, long tasks > 50 ms | ${long.length} | 0 | ${long.length === 0 ? '🟢' : '🔴'} |`,
      `| drag frame time p95 | ${p95.toFixed(1)} ms | ≤ 20 ms | ${p95 <= 20 ? '🟢' : '🔴'} |`,
      `| drag moves the slab by transform only | ${transformOnly ? 'yes' : 'no'} | yes | ${transformOnly ? '🟢' : '🔴'} |`,
      `| rAF frames delivered during the drag | ${rafFrames} | — | info |`,
      `| library | ${n} rows (5 000 tasks + 200 series) + 670 calendar events | 5 200 + 670 | 🟢 |`,
    ].join('\n')
    console.log(table)
    if (process.env.EVIDENCE) writeFileSync(`docs/evidence/arc6-slice-3-perf-${info.project.name}.md`, `# perf.spec.ts — ${new Date().toISOString()}\n\nday switches (ms): ${day.map((d) => d.toFixed(1)).join(', ')}\n\nfilter (ms): ${filt.map((d) => d.toFixed(1)).join(', ')}\n\n${table}\n`)

    expect(dayMax).toBeLessThan(200)
    expect(dayMed).toBeLessThanOrEqual(50)
    expect(p95).toBeLessThanOrEqual(20)
    expect(filterMax).toBeLessThan(50)
    expect(long).toEqual([])
    expect(transformOnly).toBe(true)
  })
})
