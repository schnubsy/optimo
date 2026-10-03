// arc 5a slice 3 — one role per calendar (Off · Show in optimo · Two-way) against the hermetic server running the real
// calendar-connect / calendar-sync handlers. Roles map onto calendars[].enabled + write_calendar_href (no DDL); exactly
// one Two-way; read-only calendars can't be Two-way; Two-way changes say what happened (#56); an Apple ID with no
// calendars is one message with a next step (#58). Desktop + iPhone 15.
import { test, expect, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { openApp } from './support/app'
import { FAKE_PASSWORD, FAKE_USER } from './fake/caldav'
import type { FakeSupabase } from './support/fakeSupabase'

const setView = (page: Page, view: string) => page.evaluate((v) => (window as any).__optimo.ui.getState().set({ view: v, mobileTab: 'board' }), view)
async function connect(page: Page) {
  await setView(page, 'settings')
  const form = page.getByTestId('calendar-connect')
  await form.getByLabel('Apple ID').fill(FAKE_USER)
  await form.getByLabel('App-specific password').fill(FAKE_PASSWORD)
  await form.getByRole('button', { name: 'Connect iCloud' }).click()
  await expect(page.getByTestId('calendar-account')).toBeVisible()
}
async function shot(page: Page, name: string) {
  await page.getByTestId('calendars').evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await page.screenshot({ path: `docs/evidence/${name}.png` })
}
const axe = async (page: Page) => (await new AxeBuilder({ page }).analyze()).violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))
const stored = (server: FakeSupabase) => [...server.rows.planner_calendar_accounts.values()][0] as any
const cal = (server: FakeSupabase, name: string) => (stored(server).calendars as { href: string; name: string; enabled: boolean }[]).find((c) => c.name === name)!
const group = (page: Page, name: string) => page.getByRole('radiogroup', { name, exact: true })
const row = (page: Page, name: string) => page.getByTestId('calendar-row').filter({ has: group(page, name) })
const pick = (page: Page, name: string, role: 'Off' | 'Show in optimo' | 'Two-way') => group(page, name).getByRole('radio', { name: role, exact: true }).click()

test.describe('calendar roles (arc 5a slice 3)', () => {
  test('mapping: Off / Show / Two-way store enabled + write_calendar_href; one Two-way; #56 toasts', async ({ page, context }, info) => {
    const { server, errors } = await openApp(page, context)
    await connect(page)
    await expect(page.getByTestId('calendar-row')).toHaveCount(3)
    // the server picks the "optimo" calendar as the write target on connect → it shows Two-way, the rest Show
    await expect(row(page, 'optimo')).toHaveAttribute('data-role', 'twoway')
    await expect(row(page, 'Home')).toHaveAttribute('data-role', 'show')
    await expect(row(page, 'Family')).toHaveAttribute('data-role', 'show')
    await expect(group(page, 'optimo').getByRole('radio', { checked: true })).toHaveText('Two-way')
    await expect(row(page, 'optimo').getByTestId('calendar-role-help')).toHaveText('optimo tasks are written here, and edits made here come back.')
    await expect(row(page, 'Home').getByTestId('calendar-role-help')).toHaveText('Its events appear in optimo. optimo never changes it.')
    await expect(page.getByTestId('calendar-no-twoway')).toHaveCount(0)
    await expect(row(page, 'Family').getByTestId('calendar-shared')).toHaveText('Shared')

    const syncs = () => server.functionCalls.filter((c) => c.name === 'calendar-sync').length
    // Off → enabled=false, write target untouched, a sync follows
    let before = syncs()
    await pick(page, 'Home', 'Off')
    await expect(row(page, 'Home')).toHaveAttribute('data-role', 'off')
    await expect(row(page, 'Home').getByTestId('calendar-role-help')).toHaveText('Hidden in optimo.')
    await expect.poll(() => cal(server, 'Home').enabled).toBe(false)
    expect(stored(server).write_calendar_href).toBe(cal(server, 'optimo').href)
    await expect.poll(syncs).toBeGreaterThan(before)
    // Show → enabled=true
    await pick(page, 'Home', 'Show in optimo')
    await expect.poll(() => cal(server, 'Home').enabled).toBe(true)

    // single Two-way: Home becomes Two-way → optimo is demoted to Show; one update stored both; the toast says what moved
    before = syncs()
    await pick(page, 'Home', 'Two-way')
    await expect(row(page, 'Home')).toHaveAttribute('data-role', 'twoway')
    await expect(row(page, 'optimo')).toHaveAttribute('data-role', 'show')
    await expect(page.getByRole('radio', { name: 'Two-way', checked: true })).toHaveCount(1)
    await expect.poll(() => stored(server).write_calendar_href).toBe(cal(server, 'Home').href)
    expect(cal(server, 'Home').enabled).toBe(true)
    expect(cal(server, 'optimo').enabled).toBe(true)
    await expect(page.getByTestId('toast')).toContainText('optimo tasks now go to “Home” — the ones already written moved there.')
    await expect.poll(syncs).toBeGreaterThan(before)
    if (process.env.EVIDENCE) {
      await expect(page.getByTestId('toast')).toHaveCount(0, { timeout: 15_000 })
      await shot(page, `arc5a-slice-3-roles-${info.project.name}`)
    }

    // Off on the Two-way row → write target cleared + the "stopped" toast + the no-Two-way note
    await pick(page, 'Home', 'Off')
    await expect.poll(() => stored(server).write_calendar_href).toBeNull()
    expect(cal(server, 'Home').enabled).toBe(false)
    await expect(page.getByTestId('toast')).toContainText('optimo stopped writing to iCloud. Events already there were left as they are.')
    await expect(page.getByTestId('calendar-no-twoway')).toHaveText('optimo isn’t writing to any calendar. Pick Two-way on one to send your tasks there.')
    // a sync must not re-pick a write target the user turned off
    await page.getByTestId('calendar-sync').click()
    await expect(page.getByTestId('calendar-sync')).toBeEnabled()
    expect(stored(server).write_calendar_href).toBeNull()
    await expect(page.getByTestId('calendar-no-twoway')).toBeVisible()

    // the first Two-way again → "now go to"
    await pick(page, 'optimo', 'Two-way')
    await expect.poll(() => stored(server).write_calendar_href).toBe(cal(server, 'optimo').href)
    await expect(page.getByTestId('toast')).toContainText('optimo tasks now go to “optimo”.')
    await expect(page.getByTestId('calendar-no-twoway')).toHaveCount(0)

    // keyboard: arrows move within a row's radiogroup
    await group(page, 'Home').getByRole('radio', { checked: true }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(row(page, 'Home')).toHaveAttribute('data-role', 'show')
    await expect(group(page, 'Home').getByRole('radio', { name: 'Show in optimo' })).toBeFocused()
    await expect.poll(() => cal(server, 'Home').enabled).toBe(true)

    // ≥ 44 px targets; axe clean in both themes
    for (const r of await page.getByTestId('calendar-role').getByRole('radio').all()) expect((await r.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    for (const theme of ['light', 'dark'] as const) {
      await page.evaluate((t) => (window as any).__optimo.repo.updateSettings({ theme: t }), theme)
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      expect(await axe(page)).toEqual([])
    }
    expect(errors).toEqual([])
  })

  test('a read-only calendar cannot be Two-way', async ({ page, context }) => {
    const { server } = await openApp(page, context)
    await connect(page)
    const twoWay = group(page, 'Family').getByRole('radio', { name: 'Two-way', exact: true })
    await expect(twoWay).toBeDisabled()
    await expect(twoWay).toHaveAttribute('title', 'This calendar is read-only on iCloud.')
    await expect(twoWay).toHaveAccessibleDescription('This calendar is read-only on iCloud.')
    // writable rows keep it
    await expect(group(page, 'Home').getByRole('radio', { name: 'Two-way', exact: true })).toBeEnabled()
    // Off / Show still work on it; the arrow keys skip the disabled option
    await pick(page, 'Family', 'Off')
    await expect.poll(() => cal(server, 'Family').enabled).toBe(false)
    await group(page, 'Family').getByRole('radio', { checked: true }).focus()
    await page.keyboard.press('ArrowLeft') // Off → (Two-way skipped) → Show
    await expect(row(page, 'Family')).toHaveAttribute('data-role', 'show')
    expect(stored(server).write_calendar_href).toBe(cal(server, 'optimo').href)
  })

  test('empty Apple ID: one message with a next step — no "0 events", no duplicate alert or toast (#58)', async ({ page, context }, info) => {
    const { server } = await openApp(page, context)
    server.caldav.state.emptyHome = true
    await connect(page)
    const acc = page.getByTestId('calendar-account')
    const message = 'No calendars on this Apple ID. Check that Calendars is turned on in iCloud settings on your iPhone or Mac, then sync again.'
    await expect(acc.getByTestId('calendar-empty')).toHaveText(message)
    await page.getByTestId('calendar-sync').click()
    await expect(page.getByTestId('calendar-sync')).toBeEnabled()
    await expect(acc.getByTestId('calendar-empty')).toHaveText(message)
    await expect(acc.getByText(/No calendars/)).toHaveCount(1)
    // slice 2 × 3: the sync button doesn't repeat it in red — it just offers to sync again
    await expect(page.getByTestId('calendar-sync-error')).toHaveCount(0)
    await expect(page.getByTestId('calendar-sync')).toHaveText('Sync again')
    await expect(acc.getByRole('alert')).toHaveCount(0)
    await expect(acc).not.toContainText('0 events')
    await expect(acc.getByTestId('calendar-status')).toHaveCount(0)
    await expect(acc.getByTestId('calendar-row')).toHaveCount(0)
    await expect(acc.getByTestId('calendar-no-twoway')).toHaveCount(0)
    await expect(page.getByTestId('toast').filter({ hasText: /No calendars|synced/ })).toHaveCount(0)
    expect(await axe(page)).toEqual([])
    if (process.env.EVIDENCE) {
      await expect(page.getByTestId('toast')).toHaveCount(0, { timeout: 15_000 })
      await shot(page, `arc5a-slice-3-empty-${info.project.name}`)
    }

    // calendars appear in iCloud → the next sync lists them with roles and the status line returns
    server.caldav.state.emptyHome = false
    await page.getByTestId('calendar-sync').click()
    await expect(acc.getByTestId('calendar-found')).toHaveText('Found 3 calendars')
    await expect(acc.getByTestId('calendar-empty')).toHaveCount(0)
    await expect(acc.getByTestId('calendar-row')).toHaveCount(3)
  })
})
