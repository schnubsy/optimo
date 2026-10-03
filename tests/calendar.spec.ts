// Arc 2 slice 4 — iCloud calendar (CalDAV, read-only), end to end: Settings → connect (the real calendar-connect
// handler, in-process, against a hermetic CalDAV server) → calendars listed → events on today's timeline via the
// sync log → details → toggle off → disconnect. Password gate: the app-specific password is nowhere after the flow.
import { test, expect, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { openApp, seedDay } from './support/app'
import { FAKE_PASSWORD, FAKE_USER } from './fake/caldav'
import type { FakeSupabase } from './support/fakeSupabase'

const setView = (page: Page, view: string) => page.evaluate((v) => (window as any).__optimo.ui.getState().set({ view: v, mobileTab: 'board' }), view)
/** Evidence: the Calendars group centred in the viewport (an element shot slides under the sticky iPhone header). */
async function shot(page: Page, name: string) {
  await page.getByTestId('calendars').evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await page.screenshot({ path: `docs/evidence/${name}.png` })
}
const events = (page: Page) => page.getByTestId('timeline').getByTestId('event')
/** A calendar's role group / row by its name (arc 5a slice 3: one role per calendar — Off · Show in optimo · Two-way). */
const group = (page: Page, name: string) => page.getByRole('radiogroup', { name, exact: true })
const calRow = (page: Page, name: string) => page.getByTestId('calendar-row').filter({ has: group(page, name) })

async function connect(page: Page, password = FAKE_PASSWORD) {
  await setView(page, 'settings')
  const form = page.getByTestId('calendar-connect')
  await form.getByLabel('Apple ID').fill(FAKE_USER)
  await form.getByLabel('App-specific password').fill(password)
  await form.getByRole('button', { name: 'Connect iCloud' }).click()
}

/** Everything the device and the server kept, as one string, for the password gate. */
async function everything(page: Page, server: FakeSupabase, consoleLines: string[]) {
  const device = await page.evaluate(async () => {
    const o = (window as any).__optimo
    const dump: unknown[] = [JSON.stringify({ ...localStorage })]
    for (const t of o.db.tables) dump.push(await t.toArray())
    return JSON.stringify(dump)
  })
  return device + JSON.stringify([...server.rows.planner_calendar_accounts.values()]) + JSON.stringify([...server.rows.planner_events.values()]) + consoleLines.join('\n')
}

test.describe('iCloud calendar (read-only)', () => {
  test('connect → calendars listed → events on today → details → turn off → disconnect; password never kept', async ({ page, context }) => {
    const consoleLines: string[] = []
    page.on('console', (m) => consoleLines.push(m.text()))
    const { server, errors } = await openApp(page, context, { seed: seedDay })
    await connect(page)
    const acc = page.getByTestId('calendar-account')
    await expect(acc).toBeVisible()
    await expect(acc).toContainText(FAKE_USER)
    // Home + optimo + the shared Family calendar (iCloud-shaped, single-quoted replies); Reminders / inbox / outbox skipped
    await expect(acc.getByTestId('calendar-row')).toHaveCount(3)
    for (const r of await acc.getByTestId('calendar-row').all()) await expect(r).not.toHaveAttribute('data-role', 'off')
    await expect(page.getByTestId('calendar-connect')).toHaveCount(0)
    expect(server.functionCalls.map((c) => `${c.name}:${c.status}`)).toEqual(['calendar-connect:200', 'calendar-sync:200'])

    await setView(page, 'day')
    const dentist = events(page).filter({ hasText: 'Dentist check-up' })
    await dentist.scrollIntoViewIfNeeded()
    await expect(dentist).toBeVisible()
    await expect(events(page).filter({ hasText: 'School run' })).toHaveCount(1) // today's instance of the series
    // fixed: not draggable, no resize handle, no complete chip
    await expect(dentist.locator('[aria-roledescription]')).toHaveCount(0)
    await expect(dentist.getByTestId('resize-handle')).toHaveCount(0)
    await dentist.getByRole('button', { name: /Dentist check-up, 10:30–11:15, calendar event/ }).click()
    await expect(page.getByTestId('event-details')).toContainText('Harbour St Dental')
    expect(await new AxeBuilder({ page }).analyze().then((r) => r.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? '')))).toEqual([])

    // calendars off → the server tombstones their events → the pull removes them
    await setView(page, 'settings')
    for (const name of ['Home', 'Family']) {
      await group(page, name).getByRole('radio', { name: 'Off', exact: true }).click()
      await expect(calRow(page, name)).toHaveAttribute('data-role', 'off')
    }
    await expect.poll(() => page.evaluate(() => (window as any).__optimo.db.events.count())).toBe(0)
    await group(page, 'Home').getByRole('radio', { name: 'Show in optimo', exact: true }).click()
    await expect.poll(() => page.evaluate(() => (window as any).__optimo.db.events.count())).toBeGreaterThan(0)

    // disconnect removes the account and every event on this device
    await page.getByTestId('calendar-disconnect').click()
    await expect(page.getByTestId('calendar-connect')).toBeVisible()
    await expect.poll(() => page.evaluate(() => (window as any).__optimo.db.events.count())).toBe(0)
    await setView(page, 'day')
    await expect(events(page)).toHaveCount(0)

    // password gate: not in the device store, localStorage, console, or any server row (only ciphertext)
    expect(await everything(page, server, consoleLines)).not.toContain(FAKE_PASSWORD)
    expect(await everything(page, server, consoleLines)).not.toContain(FAKE_PASSWORD.replace(/-/g, ''))
    expect(errors.filter((e) => !/401|Failed to load resource/.test(e))).toEqual([])
  })

  test('a wrong password shows a plain message and stores nothing', async ({ page, context }) => {
    const { server } = await openApp(page, context)
    await connect(page, 'aaaa-bbbb-cccc-dddd')
    await expect(page.getByTestId('calendar-connect').getByRole('alert')).toContainText('didn’t accept')
    await expect(page.getByTestId('calendar-connect').getByLabel('App-specific password')).toHaveValue('')
    expect(server.rows.planner_calendar_accounts.size).toBe(0)
  })

  test('free time accounts for events; events share overlap columns with tasks', async ({ page, context }) => {
    const { server } = await openApp(page, context, { seed: seedDay })
    const before = await page.getByTestId('stat-free').textContent()
    await connect(page)
    await expect(page.getByTestId('calendar-account')).toBeVisible()
    await setView(page, 'day')
    // the 10:30–11:15 dentist sits inside the 09:00–11:00 deep-work block → side by side
    await expect.poll(async () => page.getByTestId('stat-free').textContent()).not.toBe(before)
    const dentist = events(page).filter({ hasText: 'Dentist check-up' })
    await dentist.scrollIntoViewIfNeeded()
    const deep = page.locator('[data-testid="block"]', { hasText: 'Deep work' })
    const a = (await dentist.boundingBox())!
    const b = (await deep.boundingBox())!
    expect(Math.abs(a.x - b.x)).toBeGreaterThan(20)
    void server
  })

  test('honest status: "Found 3 calendars" + "synced HH:MM · N events" (the empty Apple ID: calroles.spec.ts)', async ({ page, context }, info) => {
    await openApp(page, context)
    await connect(page)
    const status = page.getByTestId('calendar-status')
    await expect(status.getByTestId('calendar-found')).toHaveText('Found 3 calendars')
    await expect(status.getByTestId('calendar-synced')).toHaveText(/^synced \d{2}:\d{2} · 12 events$/) // the app's 24 h clock, not the locale's
    await expect(page.getByTestId('calendar-account').getByRole('alert')).toHaveCount(0)
    if (process.env.EVIDENCE) await shot(page, `icloud-two-way-slice-2-status-found-${info.project.name}`)
  })

  test('picker: colour dot + Shared badge per calendar; the server-picked "optimo" calendar starts Two-way; 44 px; axe both themes', async ({ page, context }) => {
    await openApp(page, context)
    await connect(page)
    const acc = page.getByTestId('calendar-account')
    await expect(acc.getByTestId('calendar-row')).toHaveCount(3)

    // every calendar listed with its iCloud colour; only the shared one carries the badge
    await expect(acc.getByTestId('calendar-shared')).toHaveCount(1)
    await expect(calRow(page, 'Family').getByTestId('calendar-shared')).toHaveText('Shared')
    await expect(calRow(page, 'optimo').locator('.cal-dot')).toHaveCSS('background-color', 'rgb(63, 166, 107)')
    // the write target set by the server on discovery is the one Two-way calendar (role changes: calroles.spec.ts)
    await expect(calRow(page, 'optimo')).toHaveAttribute('data-role', 'twoway')
    await expect(acc.getByRole('radio', { name: 'Two-way', checked: true })).toHaveCount(1)

    // ≥ 44px targets, axe clean in both themes
    for (const t of [...(await acc.getByRole('radio').all()), acc.getByTestId('calendar-sync'), acc.getByTestId('calendar-disconnect')])
      expect((await t.boundingBox())!.height, `${await t.textContent()} height`).toBeGreaterThanOrEqual(44)
    for (const theme of ['light', 'dark'] as const) {
      await page.evaluate((t) => (window as any).__optimo.repo.updateSettings({ theme: t }), theme)
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      expect(await new AxeBuilder({ page }).analyze().then((r) => r.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? '')))).toEqual([])
    }
  })

  test('evidence: calendar picker, light + dark', async ({ page, context }, info) => {
    test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1 to refresh docs/evidence screenshots')
    await openApp(page, context, { theme: 'light' })
    await connect(page)
    await expect(page.getByTestId('calendar-found')).toBeVisible()
    await expect(page.getByTestId('calendar-row')).toHaveCount(3)
    await expect(page.getByTestId('toast')).toHaveCount(0, { timeout: 15_000 }) // the "connected" toast would cover the actions
    for (const theme of ['light', 'dark'] as const) {
      await page.evaluate((t) => (window as any).__optimo.repo.updateSettings({ theme: t }), theme)
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await shot(page, `icloud-two-way-slice-3-picker-${info.project.name}-${theme}`)
    }
  })

  test('evidence: calendar events + settings', async ({ page, context }, info) => {
    test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1 to refresh docs/evidence screenshots')
    await openApp(page, context, { seed: seedDay, theme: 'light' })
    await connect(page)
    await expect(page.getByTestId('calendar-account')).toBeVisible()
    await page.getByTestId('calendars').scrollIntoViewIfNeeded()
    await page.screenshot({ path: `docs/evidence/arc2-slice-4-settings-${info.project.name}.png` })
    await setView(page, 'day')
    const px = info.project.name === 'desktop' ? 72 : 66
    await page.getByTestId('timeline').evaluate((el, y) => (el.scrollTop = y), 7.5 * px)
    await events(page).filter({ hasText: 'Dentist' }).getByRole('button').click()
    await page.screenshot({ path: `docs/evidence/arc2-slice-4-timeline-${info.project.name}.png` })
  })
})
