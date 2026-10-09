// arc 7 slices 4 + 5 (+ the week part of slice 9): drops land at the pointer (± one snap) in the day view and the week,
// auto-scroll only at the edges, the drag shows its live time; the desktop week is readable (titles + times, lanes for
// overlaps, "planned · free", now-line, all-day + events) and each day header carries a "To place" tray that is a
// `plan` drop target (shared drag contract: `{type:'plan', day}` → repo.planForDay).
import { test, expect, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { at, CAT, openApp, row, seedDay, seedTask } from './support/app'
import type { FakeSupabase } from './support/fakeSupabase'

const EVIDENCE = !!process.env.EVIDENCE
const SNAP = 5 // DEFAULT_SETTINGS.snap
const settle = (page: Page) => page.waitForFunction(() => document.getAnimations().length === 0)
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const todayKey = () => key(new Date())
const plus = (k: string, n: number) => {
  const d = new Date(`${k}T12:00:00`)
  d.setDate(d.getDate() + n)
  return key(d)
}
/** Day offset (from today) of this week's weekday `wd` (0 = Monday … 6 = Sunday; the default week starts Monday). */
const offsetOf = (wd: number) => wd - ((new Date().getDay() + 6) % 7)
/** The week's last day when it is still ahead (null on that day itself). */
const LATER = offsetOf(6) > 0 ? plus(todayKey(), offsetOf(6)) : null
const minOf = (iso: string) => {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}
const serious = async (page: Page) => (await new AxeBuilder({ page }).analyze()).violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? '')).map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)

/** A realistic week around seedDay's today (titles are ours), plus planned ("to place") items. */
function seedWeek(s: FakeSupabase) {
  const base = seedDay(s)
  const t = (title: string, wd: number, hhmm: string, dur: number, cat: string) => {
    const off = offsetOf(wd)
    if (off === 0) return null // today belongs to seedDay
    return seedTask(s, { title, start_at: at(hhmm, off), duration_min: dur, category_id: cat }).id
  }
  const week = {
    gym: t('Gym session', 0, '07:00', 45, CAT.health),
    sprint: t('Plan the sprint', 0, '09:00', 60, CAT.work),
    design: t('Design review', 1, '10:00', 60, CAT.meet),
    blog: t('Write the blog draft', 1, '10:30', 90, CAT.learn),
    dinner: t('Dinner with Ana', 1, '19:00', 90, CAT.family),
    checkup: t('Dentist check-up', 2, '08:30', 30, CAT.health),
    numbers: t('Quarterly numbers', 2, '13:00', 120, CAT.work),
    offsite: t('Offsite planning', 3, '09:00', 180, CAT.meet),
    mum: t('Call mum', 3, '17:30', 20, CAT.family),
    notes: t('Ship the release notes', 4, '11:00', 45, CAT.work),
    drinks: t('Friday drinks', 4, '17:00', 120, CAT.personal),
    ride: t('Long ride', 5, '08:00', 150, CAT.health),
    shed: t('Fix the shed door', 5, '14:00', 60, CAT.home),
    prep: t('Meal prep', 6, '16:00', 90, CAT.home),
  }
  const planned = {
    tyres: seedTask(s, { title: 'Order new tyres', start_at: null, plan_date: todayKey(), duration_min: 30, category_id: CAT.errand }).id,
    photos: seedTask(s, { title: 'Renew passport photos', start_at: null, plan_date: plus(todayKey(), -1), duration_min: 20, category_id: CAT.personal }).id,
    // a later day of this week keeps its own item (a past day's would roll forward onto today's tray)
    agenda: LATER ? seedTask(s, { title: 'Draft the offsite agenda', start_at: null, plan_date: LATER, duration_min: 45, category_id: CAT.meet }).id : null,
  }
  const birthday = seedTask(s, { title: 'Ana’s birthday', start_at: at('00:00', offsetOf(4)), duration_min: 0, all_day: true, category_id: CAT.family }).id
  return { ...base, week, planned, birthday }
}
type Seed = ReturnType<typeof seedWeek>

/** A calendar event straight into the device store, the way the sync pull lands it (read-only on the week). */
async function addEvent(page: Page, title: string, from: string, to: string) {
  await page.evaluate(async ([s, e, t]) => {
    await (window as any).__optimo.db.events.put({ id: `ev-${t}`, account_id: 'acc', calendar_href: '/home/', uid: `uid-${t}`, title: t, location: '', start_at: s, end_at: e, all_day: false, status: null, color: '#3b82f6', deleted_at: null })
  }, [from, to, title])
}

async function openWeek(page: Page, context: import('@playwright/test').BrowserContext, opts: { theme?: 'dark'; at?: string } = {}) {
  let s!: Seed
  // desktop: tall enough that the drop targets (10:00 … 18:00) sit clear of the 48 px auto-scroll band
  const vp = page.viewportSize()!
  if (vp.width >= 1000 && vp.height < 900) await page.setViewportSize({ width: vp.width, height: 900 })
  await openApp(page, context, { at: opts.at ?? '09:00', theme: opts.theme, seed: (x) => (s = seedWeek(x)) })
  await addEvent(page, 'Flight to Lisbon', at('12:00', offsetOf(2)), at('13:00', offsetOf(2)))
  await page.evaluate(() => (window as any).__optimo.ui.getState().set({ view: 'week', mobileTab: 'board' }))
  await expect(page.getByTestId('week-col')).toHaveCount(7)
  await settle(page)
  return s
}

const col = (page: Page, day: string) => page.locator(`[data-testid="week-col"][data-day="${day}"]`)
const head = (page: Page, day: string) => page.locator(`[data-testid="week-head"][data-day="${day}"]`)
const inboxHandle = (page: Page, title: string) => page.getByTestId('inbox-row').filter({ hasText: title }).locator('[aria-roledescription="draggable task"]').first()

/** Mouse drag in small steps (dnd-kit's 4 px activation), ending exactly at `to`; optional hold before release. */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, holdMs = 0) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 6, from.y + 6, { steps: 2 })
  for (let i = 1; i <= 14; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / 14, from.y + ((to.y - from.y) * i) / 14)
  if (holdMs) await page.waitForTimeout(holdMs)
  await page.mouse.up()
}
const centre = async (page: Page, sel: string | ReturnType<Page['locator']>) => {
  const b = (await (typeof sel === 'string' ? page.locator(sel) : sel).boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, b }
}

test.describe('arc 7 slice 4 — drag accuracy', () => {
  test('day view: an inbox row dropped with the pointer on the 15:00 rail label starts at 15:00 (± snap)', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'the inbox rail is beside the timeline on desktop only')
    let s!: ReturnType<typeof seedDay>
    await openApp(page, context, { at: '09:00', seed: (x) => (s = seedDay(x)) })
    const label = page.locator('[data-testid="timeline"] [data-testid="hour-label"][data-min="900"]')
    await label.scrollIntoViewIfNeeded()
    const target = await centre(page, label)
    const src = await centre(page, inboxHandle(page, 'Reply to Ellen'))
    // the pointer lands on the label's centre, a little right of it (over the timeline)
    await drag(page, src, { x: target.b.x + target.b.width + 120, y: target.y })
    await expect.poll(async () => (await row(page, s.inbox.ellen)).start_at).not.toBeNull()
    expect(Math.abs(minOf((await row(page, s.inbox.ellen)).start_at) - 900)).toBeLessThanOrEqual(SNAP)
  })

  test('day drag: the dragged row shows its live time, the ghost shows start–end and never sits on an hour label', async ({ page, context }) => {
    let s!: ReturnType<typeof seedDay>
    await openApp(page, context, { at: '12:00', seed: (x) => (s = seedDay(x)) })
    const blk = page.locator(`[data-testid="block"][data-id="${s.ids.lunch}"]`)
    // lunch near the top of the timeline, so the drop point is well clear of the auto-scroll band
    await page.getByTestId('timeline').evaluate((el) => {
      const o = (window as any).__optimo
      el.scrollTop = o.maps.get(o.ui.getState().date).minToY(13 * 60) - 40
    })
    await settle(page)
    const chip = await centre(page, blk.getByTestId('chip'))
    const dy = await page.evaluate(() => {
      const o = (window as any).__optimo
      const m = o.maps.get(o.ui.getState().date)
      return m.minToY(14 * 60) - m.minToY(13 * 60)
    })
    await page.mouse.move(chip.x, chip.y)
    await page.mouse.down()
    await page.mouse.move(chip.x, chip.y + 6, { steps: 2 })
    for (let i = 1; i <= 10; i++) await page.mouse.move(chip.x, chip.y + (dy * i) / 10)
    const ghost = page.getByTestId('drop-ghost')
    await expect(ghost).toBeVisible()
    const start = Number(await ghost.getAttribute('data-start'))
    expect(Math.abs(start - 14 * 60)).toBeLessThanOrEqual(SNAP)
    // the dragged row's meta line follows the drop: live start, and the ghost label reads start–end
    await expect(blk).toHaveAttribute('data-live-start', String(start))
    const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    await expect(blk.locator('.node-meta')).toContainText(hhmm(start))
    await expect(page.getByTestId('drop-ghost-time')).toHaveText(`${hhmm(start)}–${hhmm(start + 60)}`)
    const g = (await page.getByTestId('drop-ghost-time').boundingBox())!
    for (const l of await page.locator('[data-testid="timeline"] [data-testid="hour-label"]').evaluateAll((els) => els.filter((e) => getComputedStyle(e).visibility !== 'hidden').map((e) => e.getBoundingClientRect().toJSON()))) {
      const apart = g.x >= l.right || l.left >= g.x + g.width || g.y >= l.bottom || l.top >= g.y + g.height
      expect(apart, `ghost label vs hour label at y ${l.top}`).toBe(true)
    }
    if (EVIDENCE && (page.viewportSize()?.width ?? 0) >= 900) {
      await page.evaluate(() => (window as any).__optimo.repo.updateSettings({ theme: 'dark' }))
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
      await page.screenshot({ path: 'docs/evidence/arc7-slice-4-drag.png' })
    }
    await page.mouse.up()
    await expect.poll(async () => minOf((await row(page, s.ids.lunch)).start_at)).toBe(start)
  })

  test('auto-scroll: a drag held mid-viewport never scrolls; at the edge it scrolls, capped, and stops when the pointer leaves the edge', async ({ page, context }) => {
    let s!: ReturnType<typeof seedDay>
    await openApp(page, context, { at: '12:00', seed: (x) => (s = seedDay(x)) })
    const tl = page.getByTestId('timeline')
    const blk = page.locator(`[data-testid="block"][data-id="${s.ids.lunch}"]`)
    await blk.scrollIntoViewIfNeeded()
    const box = (await tl.boundingBox())!
    const bar = (await page.getByTestId('tabbar').count()) ? await page.getByTestId('tabbar').boundingBox() : null
    const bottom = Math.min(box.y + box.height, bar ? bar.y : Infinity)
    const chip = await centre(page, blk.getByTestId('chip'))
    const top0 = await tl.evaluate((el) => el.scrollTop)
    // hold 600 ms around the middle (≥ 48 px from both edges)
    const mid = Math.max(box.y + 80, Math.min(bottom - 80, chip.y + 60))
    await page.mouse.move(chip.x, chip.y)
    await page.mouse.down()
    await page.mouse.move(chip.x, chip.y + 6, { steps: 2 })
    await page.mouse.move(chip.x, mid, { steps: 6 })
    await page.waitForTimeout(600)
    expect(await tl.evaluate((el) => el.scrollTop)).toBe(top0)
    // into the bottom edge band: it scrolls, at most 12 px a frame (≈ 60 fps → ≤ ~1 000 px/s with slack)
    await page.mouse.move(chip.x, bottom - 10, { steps: 4 })
    const t0 = Date.now()
    const s0 = await tl.evaluate((el) => el.scrollTop)
    await page.waitForTimeout(400)
    const s1 = await tl.evaluate((el) => el.scrollTop)
    const dt = (Date.now() - t0) / 1000
    expect(s1).toBeGreaterThan(s0)
    expect((s1 - s0) / dt).toBeLessThanOrEqual(1100)
    // back to the middle: it stops (no runaway)
    await page.mouse.move(chip.x, mid, { steps: 4 })
    await page.waitForTimeout(100)
    const s2 = await tl.evaluate((el) => el.scrollTop)
    await page.waitForTimeout(400)
    expect(await tl.evaluate((el) => el.scrollTop)).toBe(s2)
    await page.keyboard.press('Escape')
    await page.mouse.up()
  })

  test('week: an inbox row dropped on Wednesday with the pointer at the 15:00 rail label starts at 15:00 (± snap)', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'the inbox rail is beside the week on desktop only')
    const s = await openWeek(page, context)
    const wed = plus(todayKey(), offsetOf(2))
    const label = await centre(page, '[data-testid="week-hour"][data-min="900"]')
    const c = await centre(page, col(page, wed))
    await drag(page, await centre(page, inboxHandle(page, 'Read chapter 4')), { x: c.x, y: label.y })
    await expect.poll(async () => (await row(page, s.inbox.ch4)).start_at).not.toBeNull()
    const r = await row(page, s.inbox.ch4)
    expect(key(new Date(r.start_at))).toBe(wed)
    expect(Math.abs(minOf(r.start_at) - 900)).toBeLessThanOrEqual(SNAP)
    expect(r.duration_min).toBe(45)
  })

  test('week: a block dragged to Saturday 18:00 lands at 18:00 (± snap) and keeps its length', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop Week view')
    const s = await openWeek(page, context)
    const sat = plus(todayKey(), offsetOf(5))
    const blk = page.locator(`[data-testid="week-block"][data-id="${s.ids.lunch}"]`)
    const b = (await blk.boundingBox())!
    // grab the card 6 px below its top edge; its top lands on the 18:00 line
    const from = { x: b.x + b.width / 2, y: b.y + 6 }
    const l18 = await centre(page, '[data-testid="week-hour"][data-min="1080"]')
    const c = await centre(page, col(page, sat))
    await drag(page, from, { x: c.x, y: l18.y + 6 })
    await expect.poll(async () => key(new Date((await row(page, s.ids.lunch)).start_at))).toBe(sat)
    const r = await row(page, s.ids.lunch)
    expect(Math.abs(minOf(r.start_at) - 18 * 60)).toBeLessThanOrEqual(SNAP)
    expect(r.duration_min).toBe(60)
    await expect(page.getByTestId('toast')).toContainText('Moved')
  })
})

test.describe('arc 7 slice 5 — readable week', () => {
  for (const width of [1280, 1440]) {
    test(`desktop ${width}: every task shows its title + start time; overlaps side by side; planned · free; now-line; all-day + events`, async ({ page, context }, info) => {
      test.skip(info.project.name !== 'desktop', 'desktop Week view')
      await page.setViewportSize({ width, height: 900 })
      const s = await openWeek(page, context, { theme: 'dark' })
      await expect(page.getByTestId('week')).toHaveAttribute('data-wide', 'true')
      // titles + times: the title is on screen (ellipsis allowed), the time is whole (never clipped)
      const cards = await page.getByTestId('week-block').evaluateAll((els) =>
        els.map((e) => {
          const t = e.querySelector<HTMLElement>('.wn-title')
          const tm = e.querySelector<HTMLElement>('[data-testid="week-time"]')
          const r = e.getBoundingClientRect()
          const tr = tm?.getBoundingClientRect()
          return { id: (e as HTMLElement).dataset.id, lanes: Number((e as HTMLElement).dataset.lanes), title: t?.textContent ?? '', tw: t?.getBoundingClientRect().width ?? 0, time: tm?.textContent ?? '', timeClipped: !tm || tm.scrollWidth > tm.clientWidth + 0.5 || !tr || tr.right > r.right + 0.5 || tr.left < r.left - 0.5 }
        }),
      )
      expect(cards.length).toBeGreaterThanOrEqual(20)
      for (const c of cards) {
        expect(c.title.length, `title of ${c.id}`).toBeGreaterThan(0)
        // a card alone in its column gets real room for its title; a lane of a concurrent pair still shows some
        expect(c.tw, `title width of ${c.title}`).toBeGreaterThan(c.lanes === 1 ? 40 : 24)
        expect(c.time, `time of ${c.title}`).toMatch(/^\d{1,2}:\d{2}/)
        expect(c.timeClipped, `time of ${c.title} clipped`).toBe(false)
      }
      // overlapping tasks: 1:1 (16:00) and the PR review (16:15) today — side by side, boxes apart
      const a = (await page.locator(`[data-testid="week-block"][data-id="${s.ids.one}"]`).boundingBox())!
      const b = (await page.locator(`[data-testid="week-block"][data-id="${s.ids.overlap}"]`).boundingBox())!
      expect(a.x + a.width <= b.x + 0.5 || b.x + b.width <= a.x + 0.5).toBe(true)
      // no two cards in any column cover each other
      for (const d of await page.getByTestId('week-col').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.day!))) {
        const boxes = await col(page, d).locator('[data-testid="week-block"], [data-testid="week-event"]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))
        for (let i = 0; i < boxes.length; i++)
          for (let j = i + 1; j < boxes.length; j++) {
            const p = boxes[i]
            const q = boxes[j]
            const ix = Math.min(p.right, q.right) - Math.max(p.left, q.left)
            const iy = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top)
            expect(ix <= 0.5 || iy <= 0.5, `${d}: cards ${i} and ${j} overlap`).toBe(true)
          }
      }
      // per-day "Xh planned · Yh free"
      await expect(page.getByTestId('week-hours')).toHaveCount(7)
      await expect(head(page, todayKey()).getByTestId('week-hours')).toHaveText(/^(\d+h(\d\d)?|\d+m) planned · (\d+h(\d\d)?|\d+m) free$/)
      // the now-line on today's column only, at 09:00 on the column's map
      await expect(page.getByTestId('week-now')).toHaveCount(1)
      const now = col(page, todayKey()).getByTestId('week-now')
      await expect(now).toHaveAttribute('data-min', '540')
      const y = await page.evaluate((d) => {
        const c = document.querySelector(`[data-testid="week-col"][data-day="${d}"]`)!.getBoundingClientRect().top
        const h = document.querySelector('[data-testid="week-hour"][data-min="540"]')!.getBoundingClientRect().top
        return { c, h }
      }, todayKey())
      expect(Math.abs((await now.boundingBox())!.y - y.h)).toBeLessThanOrEqual(2)
      // all-day item in Friday's header; the calendar event outlined in Wednesday's column (read-only: not a button)
      await expect(head(page, plus(todayKey(), offsetOf(4))).getByTestId('week-allday')).toHaveText('Ana’s birthday')
      const ev = col(page, plus(todayKey(), offsetOf(2))).getByTestId('week-event')
      await expect(ev).toContainText('Flight to Lisbon')
      expect(await ev.evaluate((e) => e.tagName)).toBe('SPAN')
      expect(await ev.evaluate((e) => parseFloat(getComputedStyle(e).borderTopWidth))).toBeGreaterThanOrEqual(1)
      // outlined: the page background inside, not a task card's fill
      const cardBg = await page.locator(`[data-testid="week-block"][data-id="${s.ids.lunch}"]`).evaluate((e) => getComputedStyle(e).backgroundColor)
      expect(await ev.evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe(cardBg)
      expect(await serious(page)).toEqual([])
      if (EVIDENCE) {
        await page.locator('.wbody').evaluate((el) => (el.scrollTop = 0))
        await page.screenshot({ path: `docs/evidence/arc7-slice-5-week-${width}-dark.png` })
      }
    })
  }

  test('desktop 1024: narrow columns fall back to discs with a tooltip + name; the tray is a count chip that expands', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'desktop Week view')
    await page.setViewportSize({ width: 1024, height: 768 })
    const s = await openWeek(page, context)
    await expect(page.getByTestId('week')).not.toHaveAttribute('data-wide', 'true')
    const lunch = page.locator(`[data-testid="week-block"][data-id="${s.ids.lunch}"]`)
    await expect(lunch).toHaveAttribute('title', /^Lunch with Sam · 13:00$/)
    await expect(lunch).toHaveAccessibleName(/^Lunch with Sam, 13:00, /)
    const chip = head(page, todayKey()).getByTestId('week-tray-chip')
    await expect(chip).toHaveText('2 to place')
    await chip.click()
    await expect(chip).toHaveAttribute('aria-expanded', 'true')
    await expect(head(page, todayKey()).getByTestId('week-tray-item')).toHaveCount(2)
  })

  test('iPhone overview: discs with a tooltip + accessible name, concurrent tasks side by side, the now-line on today', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'iphone-15', 'the iPhone week overview')
    let s!: ReturnType<typeof seedDay>
    await openApp(page, context, { at: '09:00', seed: (x) => (s = seedDay(x)) })
    await page.evaluate(() => (window as any).__optimo.ui.getState().set({ panel: 'week' }))
    await expect(page.getByTestId('panel-sheet')).toHaveAttribute('data-detent', 'week')
    await settle(page)
    const one = page.locator(`[data-testid="week-block"][data-id="${s.ids.one}"]`)
    const rev = page.locator(`[data-testid="week-block"][data-id="${s.ids.overlap}"]`)
    await expect(one).toHaveAttribute('title', '1:1 with Dana · 16:00')
    await expect(one).toHaveAccessibleName(/^1:1 with Dana, 16:00, /)
    const a = (await one.boundingBox())!
    const b = (await rev.boundingBox())!
    expect(a.x + a.width <= b.x + 0.5 || b.x + b.width <= a.x + 0.5).toBe(true)
    await expect(col(page, todayKey()).getByTestId('week-now')).toHaveCount(1)
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT })
  })
})

test.describe('arc 7 slice 9 (week) — "To place" trays', () => {
  test.beforeEach(({ browserName: _b }, info) => test.skip(info.project.name !== 'desktop', 'desktop Week trays'))

  test('today’s tray lists its planned items + the overdue roll-forward (tagged "from <weekday>"); one dropped at Wednesday 10:00 is scheduled there', async ({ page, context }) => {
    const s = await openWeek(page, context)
    const tray = head(page, todayKey()).getByTestId('week-tray')
    await expect(tray.getByTestId('week-tray-item')).toHaveCount(2)
    const photos = tray.locator(`[data-testid="week-tray-item"][data-id="${s.planned.photos}"]`)
    const wd = new Date(`${plus(todayKey(), -1)}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })
    await expect(photos.getByTestId('week-tray-from')).toHaveText(`from ${wd}`)
    await expect(tray.locator(`[data-testid="week-tray-item"][data-id="${s.planned.tyres}"]`).getByTestId('week-tray-from')).toHaveCount(0)
    // a later day's planned item sits in that day's own tray
    if (LATER) await expect(head(page, LATER).locator(`[data-testid="week-tray-item"][data-id="${s.planned.agenda}"]`)).toHaveCount(1)

    const wed = plus(todayKey(), offsetOf(2))
    const l10 = await centre(page, '[data-testid="week-hour"][data-min="600"]')
    const c = await centre(page, col(page, wed))
    await drag(page, await centre(page, tray.locator(`[data-testid="week-tray-item"][data-id="${s.planned.tyres}"]`)), { x: c.x, y: l10.y })
    await expect.poll(async () => (await row(page, s.planned.tyres)).start_at).not.toBeNull()
    const r = await row(page, s.planned.tyres)
    expect(key(new Date(r.start_at))).toBe(wed)
    expect(Math.abs(minOf(r.start_at) - 600)).toBeLessThanOrEqual(SNAP)
    expect(r.duration_min).toBe(30)
    expect(r.plan_date).toBeNull()
    await expect(page.locator(`[data-testid="week-tray-item"][data-id="${s.planned.tyres}"]`)).toHaveCount(0)
    await expect(col(page, wed).locator(`[data-testid="week-block"][data-id="${s.planned.tyres}"]`)).toHaveCount(1)
  })

  test('an inbox row dropped on Thursday’s header is planned for Thursday (untimed), with Undo', async ({ page, context }) => {
    const s = await openWeek(page, context)
    const thu = plus(todayKey(), offsetOf(3))
    await drag(page, await centre(page, inboxHandle(page, 'Renew car registration')), await centre(page, head(page, thu).getByTestId('week-day')))
    await expect.poll(async () => (await row(page, s.inbox.rego)).plan_date).toBe(thu)
    const r = await row(page, s.inbox.rego)
    expect(r.start_at).toBeNull()
    expect(r.someday).toBe(false)
    if (thu >= todayKey()) await expect(head(page, thu).locator(`[data-testid="week-tray-item"][data-id="${s.inbox.rego}"]`)).toHaveCount(1)
    await expect(page.getByTestId('toast')).toContainText('To place')
    await page.getByTestId('toast').getByRole('button', { name: 'Undo' }).click()
    await expect.poll(async () => (await row(page, s.inbox.rego)).plan_date).toBeNull()
  })

  test('a timed block dropped on a day’s tray becomes planned for that day (start_at null)', async ({ page, context }) => {
    const s = await openWeek(page, context)
    // another day of the week (Monday, or Tuesday when today is Monday)
    const day = plus(todayKey(), offsetOf(0) === 0 ? 1 : offsetOf(0))
    const blk = page.locator(`[data-testid="week-block"][data-id="${s.ids.guitar}"]`)
    await blk.scrollIntoViewIfNeeded()
    const from = (await blk.boundingBox())!
    await drag(page, { x: from.x + from.width / 2, y: from.y + Math.min(8, from.height / 2) }, await centre(page, head(page, day).getByTestId('week-hours')))
    await expect.poll(async () => (await row(page, s.ids.guitar)).start_at).toBeNull()
    expect((await row(page, s.ids.guitar)).plan_date).toBe(day)
    await expect(page.locator(`[data-testid="week-block"][data-id="${s.ids.guitar}"]`)).toHaveCount(0)
  })
})
