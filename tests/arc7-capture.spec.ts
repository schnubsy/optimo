// arc 7 slices 6 · 8 · 9 (day) — capture → process → paint: the one-line capture (FAB / N / command line), inbox
// processing (place chips, estimates, Someday), the iPhone tab badge, ③'s place control, and the day's "To place" tray.
import { test, expect, type Page } from '@playwright/test'
import { CAT, at, openApp, seedTask } from './support/app'

const isMobile = (page: Page) => page.evaluate(() => matchMedia('(max-width: 899px)').matches)
const byTitle = (page: Page, title: string) =>
  page.evaluate(async (t) => (await (window as any).__optimo.db.tasks.toArray()).find((x: any) => x.title === t && !x.deleted_at) ?? null, title)
const settled = (page: Page) => expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0)
/** Local YYYY-MM-DD, `n` days from the page's today. */
const dayKey = (page: Page, n = 0) =>
  page.evaluate((k) => {
    const d = new Date()
    d.setDate(d.getDate() + k)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, n)

/** The capture field: iPhone FAB → the one-line sheet; desktop N → the header command line. */
async function capture(page: Page) {
  if (await isMobile(page)) {
    await page.getByTestId('fab').click()
    const f = page.getByTestId('capture-input')
    await expect(f).toBeFocused()
    return f
  }
  await page.keyboard.press('n')
  const f = page.getByTestId('quickadd')
  await expect(f).toBeFocused()
  return f
}
async function showInbox(page: Page) {
  if (await isMobile(page)) await page.getByTestId('tab-backlog').click()
}
async function showTimeline(page: Page) {
  if (await isMobile(page)) await page.getByTestId('tab-timeline').click()
}
const inboxRow = (page: Page, title: string) => page.getByTestId('inbox-row').filter({ hasText: title })

test.describe('arc 7 — capture', () => {
  test('plain text → Inbox, untimed, no estimate; the field stays open and empty', async ({ page, context }) => {
    const { errors } = await openApp(page, context, { at: '09:00' })
    const f = await capture(page)
    await f.fill('Call plumber')
    if (await isMobile(page)) await expect(page.getByTestId('capture-chip')).toHaveCount(0)
    else await expect(page.getByTestId('parse-row')).toContainText('inbox')
    await f.press('Enter')
    await expect.poll(() => byTitle(page, 'Call plumber')).toMatchObject({ start_at: null, plan_date: null, someday: false, estimated: false, _kind: 'inbox' })
    await expect(f).toHaveValue('')
    await expect(f).toBeFocused()
    if (await isMobile(page)) {
      await expect(page.getByTestId('capture-sheet')).toBeVisible()
      await expect(page.getByTestId('capture-added')).toContainText('Added to Inbox')
      // the next one goes straight in
      await f.fill('Buy stamps')
      await f.press('Enter')
      await expect.poll(() => byTitle(page, 'Buy stamps')).toMatchObject({ start_at: null, estimated: false })
      // Undo takes the last one back
      await page.getByTestId('capture-undo').click()
      await expect.poll(() => byTitle(page, 'Buy stamps')).toBeNull()
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('capture-sheet')).toHaveCount(0)
    }
    await showInbox(page)
    await expect(inboxRow(page, 'Call plumber').getByTestId('inbox-est')).toHaveText('no estimate')
    expect(errors).toEqual([])
  })

  test('a typed time shows a chip first, and Enter schedules it (20:00 for 90 min)', async ({ page, context }) => {
    await openApp(page, context, { at: '09:00' })
    await page.evaluate(() => (window as any).__optimo.repo.updateSettings({ clock24: false }))
    const f = await capture(page)
    await f.fill('Movie night at 8pm for 1.5h')
    if (await isMobile(page)) await expect(page.getByTestId('capture-chip')).toContainText('Today 8 PM · 1.5h')
    else await expect(page.getByTestId('parse-row')).toContainText('8:00 PM')
    await f.press('Enter')
    await expect.poll(async () => {
      const t = await byTitle(page, 'Movie night')
      return t && { h: new Date(t.start_at).getHours(), m: new Date(t.start_at).getMinutes(), d: t.duration_min }
    }).toEqual({ h: 20, m: 0, d: 90 })
  })

  test('the chip is removable: the line then goes to the Inbox as typed', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'iphone-15', 'the capture sheet is iPhone')
    await openApp(page, context, { at: '09:00' })
    const f = await capture(page)
    await f.fill('Movie night at 8pm')
    await page.getByTestId('capture-chip-x').click()
    await expect(page.getByTestId('capture-chip')).toHaveCount(0)
    await f.press('Enter')
    await expect.poll(() => byTitle(page, 'Movie night at 8pm')).toMatchObject({ start_at: null, _kind: 'inbox' })
  })

  test('a day without a time plans it ("Dentist thursday"); "someday" parks it', async ({ page, context }) => {
    await openApp(page, context, { at: '09:00' })
    const f = await capture(page)
    await f.fill('Dentist thursday')
    if (await isMobile(page)) await expect(page.getByTestId('capture-chip')).toContainText(/^Plan for (Thu|Today)/)
    else await expect(page.getByTestId('parse-row')).toContainText('plan for')
    await f.press('Enter')
    await expect.poll(() => byTitle(page, 'Dentist')).toMatchObject({ start_at: null, _kind: 'planned' })
    const t = await byTitle(page, 'Dentist')
    const [y, m, d] = t.plan_date.split('-').map(Number)
    expect(new Date(y, m - 1, d).getDay()).toBe(4)
    expect(t.plan_date >= (await dayKey(page))).toBe(true)

    await f.fill('someday learn piano')
    if (await isMobile(page)) await expect(page.getByTestId('capture-chip')).toHaveText('Someday')
    await f.press('Enter')
    await expect.poll(() => byTitle(page, 'Learn piano')).toMatchObject({ start_at: null, plan_date: null, someday: true, _kind: 'someday' })
  })

  test('Details… hands the line to the full wizard', async ({ page, context }) => {
    await openApp(page, context, { at: '09:00' })
    const f = await capture(page)
    await f.fill('Lunch with Sam at 1pm')
    await page.getByTestId((await isMobile(page)) ? 'capture-details' : 'quickadd-details').click()
    await expect(page.getByTestId('wizard')).toHaveAttribute('data-step', '1')
    await expect(page.getByTestId('wizard-title')).toHaveValue('Lunch with Sam at 1pm')
  })
})

test.describe('arc 7 — inbox processing', () => {
  test('row → Today plans it for today and it lands in today’s tray', async ({ page, context }) => {
    let id = ''
    await openApp(page, context, { at: '09:00', seed: (s) => (id = seedTask(s, { title: 'Water the plants', start_at: null, duration_min: 30, category_id: CAT.home, estimated: false }).id) })
    await showInbox(page)
    const r = page.locator(`[data-testid="inbox-row"][data-id="${id}"]`)
    await r.getByTestId('inbox-main').click()
    await expect(r.getByTestId('inbox-process')).toBeVisible()
    await r.getByTestId('process-today').click()
    await expect.poll(async () => (await page.evaluate((i) => (window as any).__optimo.db.tasks.get(i), id)).plan_date).toBe(await dayKey(page))
    await expect(r).toHaveCount(0)
    await showTimeline(page)
    const tray = page.getByTestId('tray')
    await expect(tray).toBeVisible()
    await expect(tray.getByTestId('tray-chip')).toHaveText(/Water the plants/)
    await expect(tray.getByTestId('tray-count')).toHaveText('1')
  })

  test('estimate chips: 60 sets the duration and marks it estimated; ? clears it', async ({ page, context }) => {
    let id = ''
    await openApp(page, context, { at: '09:00', seed: (s) => (id = seedTask(s, { title: 'Sort receipts', start_at: null, duration_min: 30, estimated: false }).id) })
    await showInbox(page)
    const r = page.locator(`[data-testid="inbox-row"][data-id="${id}"]`)
    await expect(r.getByTestId('inbox-est')).toHaveText('no estimate')
    await r.getByTestId('inbox-main').click()
    await r.getByTestId('estimate-60').click()
    await expect.poll(async () => {
      const t = await page.evaluate((i) => (window as any).__optimo.db.tasks.get(i), id)
      return [t.duration_min, t.estimated]
    }).toEqual([60, true])
    await expect(r.getByTestId('estimate-60')).toHaveAttribute('aria-pressed', 'true')
    await expect(r.getByTestId('inbox-est')).toHaveText('1 hr')
    await r.getByTestId('estimate-none').click()
    await expect.poll(async () => (await page.evaluate((i) => (window as any).__optimo.db.tasks.get(i), id)).estimated).toBe(false)
  })

  test('keyboard on a focused row: 2 → 30 min, M → tomorrow (the global M/T stay out of it)', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'keyboard')
    let id = ''
    await openApp(page, context, { at: '09:00', seed: (s) => (id = seedTask(s, { title: 'Draft the newsletter', start_at: null, duration_min: 30, estimated: false }).id) })
    const r = page.locator(`[data-testid="inbox-row"][data-id="${id}"]`)
    await r.getByTestId('inbox-main').focus()
    await page.keyboard.press('2')
    await expect.poll(async () => (await page.evaluate((i) => (window as any).__optimo.db.tasks.get(i), id)).estimated).toBe(true)
    await page.keyboard.press('m')
    await expect.poll(async () => (await page.evaluate((i) => (window as any).__optimo.db.tasks.get(i), id)).plan_date).toBe(await dayKey(page, 1))
    expect(await page.evaluate(() => (window as any).__optimo.ui.getState().view)).toBe('day') // not the month
  })

  test('Someday: a collapsed section; rows move back to the inbox and to a day', async ({ page, context }) => {
    let a = ''
    let b = ''
    await openApp(page, context, {
      at: '09:00',
      seed: (s) => {
        a = seedTask(s, { title: 'Learn to juggle', start_at: null, someday: true }).id
        b = seedTask(s, { title: 'Repaint the fence', start_at: null, someday: true }).id
        seedTask(s, { title: 'Return library books', start_at: null })
      },
    })
    await showInbox(page)
    const sec = page.getByTestId('someday')
    const toggle = sec.getByTestId('someday-toggle')
    await expect(toggle).toHaveText(/Someday \(2\)/)
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(sec.getByTestId('someday-row')).toHaveCount(0)
    await toggle.click()
    await expect(sec.getByTestId('someday-row')).toHaveCount(2)
    await sec.locator(`[data-testid="someday-row"][data-id="${a}"]`).getByTestId('someday-inbox').click()
    await expect.poll(async () => (await page.evaluate((i) => (window as any).__optimo.db.tasks.get(i), a))._kind).toBe('inbox')
    await expect(inboxRow(page, 'Learn to juggle')).toBeVisible()
    const day = await dayKey(page, 3)
    await sec.locator(`[data-testid="someday-row"][data-id="${b}"]`).getByTestId('someday-day').fill(day)
    await expect.poll(async () => (await page.evaluate((i) => (window as any).__optimo.db.tasks.get(i), b)).plan_date).toBe(day)
    await expect(page.getByTestId('someday')).toHaveCount(0) // an empty Someday hides
  })

  test('iPhone: the Inbox tab badge counts unfinished inbox items and follows changes', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'iphone-15', 'tab bar')
    await openApp(page, context, {
      at: '09:00',
      seed: (s) => {
        seedTask(s, { title: 'Alpha', start_at: null })
        seedTask(s, { title: 'Bravo', start_at: null })
        seedTask(s, { title: 'Done already', start_at: null, completed_at: at('08:00') })
        seedTask(s, { title: 'Planned', start_at: null, plan_date: '2099-01-01' })
      },
    })
    const tab = page.getByTestId('tab-backlog')
    await expect(tab.getByTestId('tab-badge')).toHaveText('2')
    await expect(tab).toHaveAccessibleName('Inbox, 2 items')
    const f = await capture(page)
    await f.fill('Charlie')
    await f.press('Enter')
    await expect(tab.getByTestId('tab-badge')).toHaveText('3')
    await page.keyboard.press('Escape')
    await tab.click()
    await expect(page.getByTestId('inbox-count')).toContainText('3 in inbox')
    for (const t of ['Alpha', 'Bravo', 'Charlie']) await inboxRow(page, t).getByTestId('inbox-ring').click()
    await expect(tab.getByTestId('tab-badge')).toHaveCount(0)
    await expect(tab).toHaveAccessibleName('Inbox')
  })

  test('inbox zero reads in our words', async ({ page, context }) => {
    await openApp(page, context, { at: '09:00' })
    await showInbox(page)
    await expect(page.getByTestId('inbox-zero')).toHaveText(/All sorted\./)
  })
})

test.describe('arc 7 — ③ place control', () => {
  test('a timed task → Inbox (start_at null), then back onto the timeline through ②', async ({ page, context }) => {
    let id = ''
    await openApp(page, context, { at: '09:00', seed: (s) => (id = seedTask(s, { title: 'Pay the gas bill', start_at: at('11:00'), duration_min: 30, category_id: CAT.errand }).id) })
    const chip = page.locator(`[data-testid="block"][data-id="${id}"] [data-testid="chip"]`)
    await chip.scrollIntoViewIfNeeded()
    await chip.click()
    const place = page.getByTestId('details-place')
    await expect(place).toHaveAttribute('data-place', 'timeline')
    await expect(place.getByTestId('place-timeline')).toHaveAttribute('aria-pressed', 'true')
    await place.getByTestId('place-inbox').click()
    await expect(place).toHaveAttribute('data-place', 'inbox')
    await expect(page.getByTestId('details-inbox')).toBeVisible()
    await page.getByTestId('wizard-save').click()
    await expect.poll(async () => (await page.evaluate((i) => (window as any).__optimo.db.tasks.get(i), id)).start_at).toBeNull()

    // reopen from the inbox (the disc opens the editor) and put it back on the timeline at 15:00
    await showInbox(page)
    await page.locator(`[data-testid="inbox-row"][data-id="${id}"] .irow-chip`).click()
    await expect(page.getByTestId('details-place')).toHaveAttribute('data-place', 'inbox')
    await page.getByTestId('place-tomorrow').click()
    await expect(page.getByTestId('wizard-meta')).toContainText('Tomorrow')
    await page.getByTestId('place-timeline').click()
    const w = page.getByTestId('wizard')
    await expect(w).toHaveAttribute('data-step', '2')
    await expect(w).toHaveAttribute('data-date', await dayKey(page, 1)) // the day it was planned for
    await page.getByTestId('wizard-continue').click()
    await expect(w).toHaveAttribute('data-step', '3')
    await page.getByTestId('wizard-save').click()
    await expect.poll(() =>
      page.evaluate(async (i) => {
        const t = await (window as any).__optimo.db.tasks.get(i)
        if (!t.start_at) return null
        const d = new Date(t.start_at)
        return { day: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, kind: t._kind, plan: t.plan_date }
      }, id),
    ).toEqual({ day: await dayKey(page, 1), kind: 'sched', plan: null })
  })
})

test.describe('arc 7 — the day tray', () => {
  async function seedTray(page: Page, context: Parameters<typeof openApp>[1]) {
    const ids: Record<string, string> = {}
    await openApp(page, context, {
      at: '09:00',
      seed: (s) => {
        const today = new Date()
        const key = (n: number) => {
          const d = new Date(today)
          d.setDate(d.getDate() + n)
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        }
        ids.read = seedTask(s, { title: 'Read the lease', start_at: null, plan_date: key(0), duration_min: 45, estimated: true, category_id: CAT.home }).id
        ids.call = seedTask(s, { title: 'Call the bank', start_at: null, plan_date: key(0), duration_min: 30, estimated: false, category_id: CAT.errand }).id
        ids.late = seedTask(s, { title: 'Send the invoice', start_at: null, plan_date: key(-3), duration_min: 15, estimated: true, category_id: CAT.work }).id
        seedTask(s, { title: 'Standup', start_at: at('09:30'), duration_min: 30, category_id: CAT.meet })
      },
    })
    return ids
  }
  const chipOf = (page: Page, id: string) => page.locator(`[data-testid="tray-chip"][data-id="${id}"]`)

  test('lists the day’s planned items + overdue ones "from <day>"; hidden when empty', async ({ page, context }) => {
    const ids = await seedTray(page, context)
    const tray = page.getByTestId('tray')
    await expect(tray.getByTestId('tray-count')).toHaveText('3')
    await expect(chipOf(page, ids.read)).toContainText('45m')
    await expect(chipOf(page, ids.call)).toContainText('—')
    await expect(chipOf(page, ids.late).getByTestId('tray-from')).toHaveText(/^from (Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/)
    // the tray sits above the timeline's first row
    const tb = (await tray.boundingBox())!
    const tl = (await page.getByTestId('timeline').boundingBox())!
    expect(tb.y + tb.height).toBeLessThanOrEqual(tl.y + 1)
    // tomorrow's tray is empty → no tray
    await page.evaluate((d) => (window as any).__optimo.ui.getState().set({ date: d }), await dayKey(page, 1))
    await expect(page.getByTestId('tray')).toHaveCount(0)
  })

  test('chip → Place schedules it into a free slot', async ({ page, context }) => {
    const ids = await seedTray(page, context)
    await chipOf(page, ids.read).click()
    await page.getByTestId('tray-place').click()
    const picker = page.getByTestId('place-picker')
    await expect(picker).toBeVisible()
    await picker.getByTestId('slot').first().click()
    await expect.poll(async () => (await page.evaluate((i) => (window as any).__optimo.db.tasks.get(i), ids.read))._kind).toBe('sched')
    const t = await page.evaluate((i) => (window as any).__optimo.db.tasks.get(i), ids.read)
    expect(t.plan_date).toBeNull()
    await expect(chipOf(page, ids.read)).toHaveCount(0)
    await expect(page.locator(`[data-testid="block"][data-id="${ids.read}"]`)).toBeAttached()
  })

  test('chip → Back to inbox / Move to tomorrow / Someday', async ({ page, context }) => {
    const ids = await seedTray(page, context)
    await chipOf(page, ids.call).click()
    await page.getByTestId('tray-inbox').click()
    await expect.poll(async () => (await page.evaluate((i) => (window as any).__optimo.db.tasks.get(i), ids.call))._kind).toBe('inbox')
    await expect(chipOf(page, ids.call)).toHaveCount(0)
    await chipOf(page, ids.late).click()
    await page.getByTestId('tray-tomorrow').click()
    await expect.poll(async () => (await page.evaluate((i) => (window as any).__optimo.db.tasks.get(i), ids.late)).plan_date).toBe(await dayKey(page, 1))
    await chipOf(page, ids.read).click()
    await page.getByTestId('tray-someday').click()
    await expect.poll(async () => (await page.evaluate((i) => (window as any).__optimo.db.tasks.get(i), ids.read))._kind).toBe('someday')
    await expect(page.getByTestId('tray')).toHaveCount(0)
  })

  test('chip → Pick a time opens ② for it', async ({ page, context }) => {
    const ids = await seedTray(page, context)
    await chipOf(page, ids.read).click()
    await page.getByTestId('tray-time').click()
    const w = page.getByTestId('wizard')
    await expect(w).toHaveAttribute('data-step', '2')
    await expect(w).toHaveAttribute('data-mode', 'timeline')
    await page.getByTestId('wizard-continue').click()
    await page.getByTestId('wizard-save').click()
    await expect.poll(async () => (await page.evaluate((i) => (window as any).__optimo.db.tasks.get(i), ids.read))._kind).toBe('sched')
  })

  test('Fit with AI opens the AI tab with the tray items as the intent (not sent)', async ({ page, context }) => {
    await seedTray(page, context)
    await page.getByTestId('tray-fit').click()
    const intent = page.getByTestId('plan-intent')
    await expect(intent).toBeVisible()
    await expect(intent).toHaveValue(/^Fit these into my day: /)
    for (const t of ['Read the lease (45m)', 'Call the bank (~30m)', 'Send the invoice (15m)']) await expect(intent).toHaveValue(new RegExp(t.replace(/[()]/g, '\\$&')))
    if (await isMobile(page)) await expect(page.getByTestId('tab-plan')).toHaveAttribute('aria-selected', 'true')
    expect(await page.evaluate(async () => (await (window as any).__optimo.db.aiPlans.count()))).toBe(0)
  })

  test('evidence screenshots', async ({ page, context }, info) => {
    test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1')
    const mobile = info.project.name === 'iphone-15'
    if (mobile) await page.setViewportSize({ width: 402, height: 874 })
    const ids = await seedTray(page, context)
    void ids
    await page.evaluate(() => (window as any).__optimo.repo.updateSettings({ clock24: false }))
    await page.evaluate(() => {
      const r = (window as any).__optimo.repo
      return Promise.all([
        r.captureToInbox('Call plumber'),
        r.captureToInbox('Book flights for October', { duration_min: 30 }),
        r.captureToInbox('Renew car registration', { duration_min: 20 }),
        r.captureToInbox('Learn to juggle', { someday: true }),
        r.captureToInbox('Repaint the fence', { someday: true }),
      ])
    })
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.evaluate(() => (window as any).__optimo.repo.updateSettings({ theme: 'dark' }))
    await settled(page)
    await page.screenshot({ path: `docs/evidence/arc7-slice-8-tray-${mobile ? 'iphone' : 'desktop'}.png` })
    if (mobile) {
      await page.getByTestId('fab').click()
      await page.getByTestId('capture-input').fill('Movie night at 8pm for 1.5h')
      await settled(page)
      await page.screenshot({ path: 'docs/evidence/arc7-slice-8-capture-iphone.png' })
      await page.keyboard.press('Escape')
      await page.getByTestId('tab-backlog').click()
    }
    await inboxRow(page, 'Call plumber').getByTestId('inbox-main').click()
    await page.getByTestId('someday-toggle').click()
    await settled(page)
    await page.screenshot({ path: `docs/evidence/arc7-slice-8-inbox-${mobile ? 'iphone' : 'desktop'}.png` })
  })
})
