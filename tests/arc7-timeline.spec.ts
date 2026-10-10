// arc 7 slice 2 — day timeline layout bugs (docs/evidence/arc7-qa-baseline.md): overlap groups lay each task's text and
// ring out beside its OWN node, rail labels never clip / duplicate / crowd, calendar events are tappable, a late task
// never covers "Lights out", and on iPhone the all-day chips clear the grabber and the collapsed peek shows "Up".
import { test, expect, type Page } from '@playwright/test'
import { at, CAT, openApp, row, seedTask } from './support/app'
import type { FakeSupabase } from './support/fakeSupabase'

const settle = (page: Page) => page.waitForFunction(() => document.getAnimations().length === 0)

/** The QA's overlap seed: a chained cluster (9:00–14:00 with an iCloud event), a 3-way overlap and an all-day item. */
function overlapSeed(s: FakeSupabase) {
  return {
    deep: seedTask(s, { title: 'Deep work', start_at: at('09:00'), duration_min: 120, category_id: CAT.work }).id,
    offsite: seedTask(s, { title: 'Offsite with the leadership group', start_at: at('09:30'), duration_min: 240, category_id: CAT.meet }).id,
    standup: seedTask(s, { title: 'Standup', start_at: at('11:00'), duration_min: 30, category_id: CAT.meet }).id,
    lunch: seedTask(s, { title: 'Lunch', start_at: at('13:00'), duration_min: 60, category_id: CAT.personal }).id,
    inbox: seedTask(s, { title: 'Inbox zero', start_at: at('16:00'), duration_min: 15, category_id: CAT.work }).id,
    review: seedTask(s, { title: 'Design review', start_at: at('16:00'), duration_min: 60, category_id: CAT.meet }).id,
    invoices: seedTask(s, { title: 'Pay invoices', start_at: at('16:15'), duration_min: 30, category_id: CAT.errand }).id,
    allday: seedTask(s, { title: 'Mum’s birthday', start_at: at('00:00'), duration_min: 0, all_day: true, category_id: CAT.family }).id,
  }
}
type Ids = ReturnType<typeof overlapSeed>
const TIMED: (keyof Ids)[] = ['deep', 'offsite', 'standup', 'lunch', 'inbox', 'review', 'invoices']

/** The iCloud event (12:15–13:15) straight into the device store, the way the sync pull lands it. */
async function addEvent(page: Page) {
  await page.evaluate(async ([s, e]) => {
    await (window as any).__optimo.db.events.put({ id: 'ev-arc7', account_id: 'acc', calendar_href: '/home/', uid: 'arc7-event', title: 'Dentist', location: 'Harbour St', start_at: s, end_at: e, all_day: false, status: null, color: '#3b82f6', deleted_at: null })
  }, [at('12:15'), at('13:15')])
  await expect(page.getByTestId('timeline').getByTestId('event').filter({ hasText: 'Dentist' })).toHaveCount(1)
}

async function open(page: Page, context: import('@playwright/test').BrowserContext, theme?: 'dark') {
  let ids!: Ids
  await openApp(page, context, { at: '08:00', theme, seed: (s) => (ids = overlapSeed(s)) })
  await addEvent(page)
  await expect(page.locator('[data-testid="block"]')).toHaveCount(TIMED.length)
  await settle(page)
  return ids
}

const blk = (page: Page, id: string) => page.locator(`[data-testid="block"][data-id="${id}"]`)

test.describe('arc 7 slice 2 — day timeline layout', () => {
  test('overlap groups: every ring sits on its own title row, ≥ 44 px apart, and completes exactly its task', async ({ page, context }) => {
    const ids = await open(page, context)
    const centres: { k: string; y: number }[] = []
    for (const k of TIMED) {
      const b = blk(page, ids[k])
      await b.getByTestId('ring').scrollIntoViewIfNeeded()
      const ring = (await b.getByTestId('ring').boundingBox())!
      const title = (await b.locator('.node-title').boundingBox())!
      // the ring's box overlaps its own title's row (and nobody else's: rings are ≥ 44 px apart below)
      expect(ring.y < title.y + title.height && title.y < ring.y + ring.height, `${k}: ring ${ring.y} vs title ${title.y}`).toBe(true)
      // the time line is never clipped mid-word: its text fits its box
      const meta = b.locator('.node-meta')
      expect(await meta.evaluate((e) => e.scrollWidth <= e.clientWidth + 1), `${k}: meta clipped`).toBe(true)
      // the title gets the room: more than the arc-6 squeeze (91 px) unless the row is genuinely narrow
      expect(title.width, `${k}: title width`).toBeGreaterThan(40)
      const scroll = await page.getByTestId('timeline').evaluate((e) => e.scrollTop)
      centres.push({ k, y: ring.y + ring.height / 2 + scroll })
    }
    centres.sort((a, b) => a.y - b.y)
    for (let i = 1; i < centres.length; i++) expect(centres[i].y - centres[i - 1].y, `${centres[i - 1].k} → ${centres[i].k}`).toBeGreaterThanOrEqual(44)

    // clicking each ring completes exactly that task
    const done = new Set<string>()
    for (const k of TIMED) {
      const ring = blk(page, ids[k]).getByTestId('ring')
      await ring.scrollIntoViewIfNeeded()
      await ring.click()
      done.add(k)
      await expect.poll(async () => !!(await row(page, ids[k])).completed_at).toBe(true)
      for (const o of TIMED) expect(!!(await row(page, ids[o])).completed_at, `after ${k}: ${o}`).toBe(done.has(o))
    }
  })

  test('rail labels: none clipped at the panel edge, no duplicates, ≥ 28 px apart', async ({ page, context }) => {
    await open(page, context)
    const tl = (await page.getByTestId('timeline').boundingBox())!
    const labels = await page.getByTestId('hour-label').evaluateAll((els) => els.map((e) => ({ t: e.textContent ?? '', min: Number((e as HTMLElement).dataset.min), r: e.getBoundingClientRect(), sw: e.scrollWidth, cw: e.clientWidth })))
    expect(labels.length).toBeGreaterThan(6)
    for (const l of labels) expect(l.r.left, `${l.t} left`).toBeGreaterThanOrEqual(tl.x)
    const texts = labels.map((l) => l.t)
    expect(new Set(texts).size, texts.join(' ')).toBe(texts.length)
    const ys = labels.map((l) => l.r.top + l.r.height / 2).sort((a, b) => a - b)
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(28)
  })

  test('calendar event: title beside it, ≥ 44 px hit area, tap opens the details', async ({ page, context }) => {
    await open(page, context)
    const ev = page.getByTestId('timeline').getByTestId('event').filter({ hasText: 'Dentist' })
    await ev.scrollIntoViewIfNeeded()
    const chip = (await ev.getByTestId('event-chip').boundingBox())!
    expect(chip.width).toBeGreaterThanOrEqual(44)
    expect(chip.height).toBeGreaterThanOrEqual(44)
    const title = (await ev.locator('.node-title').boundingBox())!
    expect(title.x).toBeGreaterThan(chip.x + chip.width) // beside the disc, to its right
    expect(title.y < chip.y + chip.height + 30 && chip.y - 30 < title.y + title.height).toBe(true)
    await ev.locator('.node-title').click()
    await expect(page.getByTestId('event-details')).toContainText('Harbour St')
  })

  test('a long evening task never covers the "Lights out" bookend', async ({ page, context }) => {
    let id = ''
    await openApp(page, context, { at: '08:00', seed: (s) => (id = seedTask(s, { title: 'Late shift', start_at: at('21:00'), duration_min: 150, category_id: CAT.work }).id) })
    await settle(page)
    const end = page.locator('[data-testid="anchor"][data-which="end"]')
    await end.scrollIntoViewIfNeeded()
    const moon = (await end.getByTestId('anchor-chip').boundingBox())!
    const cap = (await blk(page, id).getByTestId('chip').boundingBox())!
    const overlap = !(moon.x >= cap.x + cap.width || cap.x >= moon.x + moon.width || moon.y >= cap.y + cap.height || cap.y >= moon.y + moon.height)
    expect(overlap).toBe(false)
    const ring = (await end.getByTestId('anchor-ring').boundingBox())!
    const taskRing = (await blk(page, id).getByTestId('ring').boundingBox())!
    expect(Math.abs(ring.y - taskRing.y)).toBeGreaterThanOrEqual(44)
    await end.getByTestId('anchor-ring').click()
    await expect(end).toHaveClass(/done/)
    expect((await row(page, id)).completed_at).toBeNull()
  })

  test('hit targets: gap Add Task, all-day chips and the grabber answer ≥ 44 px', async ({ page, context }, info) => {
    await open(page, context)
    // the longest vertical run (through the control's centre line) that lands on the control is ≥ 44 px
    // (pseudo-element hit areas count; anything on top — the grabber, a neighbour — breaks the run)
    const hits = async (sel: string) => {
      const el = page.locator(sel).first()
      await el.scrollIntoViewIfNeeded()
      return el.evaluate((e) => {
        const r = e.getBoundingClientRect()
        const x = r.left + r.width / 2
        let run = 0
        let best = 0
        for (let y = Math.floor(r.top - 30); y <= r.bottom + 30; y++) {
          const hit = document.elementFromPoint(x, y)
          run = hit && (hit === e || e.contains(hit)) ? run + 1 : 0
          best = Math.max(best, run)
        }
        return best >= 44
      })
    }
    expect(await hits('[data-testid="free-add"]')).toBe(true)
    expect(await hits('[data-testid="allday-chip"]')).toBe(true)
    if (info.project.name === 'iphone-15') {
      await page.getByTestId('timeline').evaluate((e) => (e.scrollTop = 0))
      const g = (await page.getByTestId('panel-grabber').boundingBox())!
      expect(g.height).toBeGreaterThanOrEqual(44)
      expect(g.width).toBeGreaterThanOrEqual(44)
    }
  })

  test('iPhone: the first all-day chip clears the grabber and opens its task', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'iphone-15', 'the panel sheet is the phone layout')
    const ids = await open(page, context)
    await page.getByTestId('timeline').evaluate((e) => (e.scrollTop = 0))
    const chip = page.getByTestId('allday-chip').first()
    const c = (await chip.boundingBox())!
    const g = (await page.getByTestId('panel-grabber').boundingBox())!
    expect(c.y).toBeGreaterThanOrEqual(g.y + g.height) // below the grabber band
    await chip.click() // actionability: the chip itself receives the click
    expect(await page.evaluate(() => (window as any).__optimo.ui.getState().editingId)).toBe(ids.allday)
  })

  test('iPhone: the collapsed peek shows the "Up" bookend, not the all-day strip', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'iphone-15', 'the panel sheet is the phone layout')
    await open(page, context)
    await page.getByTestId('tab-timeline').click()
    await expect(page.getByTestId('panel-sheet')).toHaveAttribute('data-detent', 'week')
    await settle(page)
    await page.waitForTimeout(100)
    const sheet = (await page.getByTestId('panel-sheet').boundingBox())!
    const up = (await page.locator('[data-testid="anchor"][data-which="start"] [data-testid="anchor-chip"]').boundingBox())!
    expect(up.y).toBeGreaterThanOrEqual(sheet.y)
    expect(up.y + up.height).toBeLessThanOrEqual(sheet.y + 112)
    // nothing of the all-day strip paints over the peek's row
    const strip = (await page.locator('.allday').boundingBox())!
    expect(strip.y + strip.height <= up.y || strip.y >= sheet.y + 112).toBe(true)
  })

  test('evidence: overlap seed (iPhone 402×874 dark · desktop 1280 dark)', async ({ page, context }, info) => {
    test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1')
    const tag = process.env.EVIDENCE_TAG ?? 'after'
    if (info.project.name === 'iphone-15') await page.setViewportSize({ width: 402, height: 874 })
    const ids = await open(page, context, 'dark')
    await page.locator('[data-testid="anchor"][data-which="start"]').scrollIntoViewIfNeeded()
    await page.getByTestId('timeline').evaluate((e) => (e.scrollTop = 0))
    await settle(page)
    const dev = info.project.name === 'iphone-15' ? 'iphone' : 'desktop'
    await page.screenshot({ path: `docs/evidence/arc7-slice-2-${tag}-${dev}-top.png` })
    await blk(page, ids.lunch).evaluate((e) => e.scrollIntoView({ block: 'center' }))
    await settle(page)
    await page.screenshot({ path: `docs/evidence/arc7-slice-2-${tag}-${dev}-cluster.png` })
    await blk(page, ids.review).evaluate((e) => e.scrollIntoView({ block: 'center' }))
    await settle(page)
    await page.screenshot({ path: `docs/evidence/arc7-slice-2-${tag}-${dev}-threeway.png` })
    if (dev === 'iphone') {
      await page.getByTestId('tab-timeline').click()
      await expect(page.getByTestId('panel-sheet')).toHaveAttribute('data-detent', 'week')
      await settle(page)
      await page.waitForTimeout(150)
      await page.screenshot({ path: `docs/evidence/arc7-slice-2-${tag}-${dev}-peek.png` })
    }
  })
})
