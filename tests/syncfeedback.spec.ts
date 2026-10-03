// arc 5a slice 2 — Settings → Calendars sync feedback, end to end against the hermetic server (the REAL calendar-sync
// handler in-process): pressed → spinner + "Syncing…" (disabled, aria-busy) → "Synced · N events · N sent to iCloud" →
// "Sync now" after ~4 s; a failure → red reason + Retry; an automatic (after-push) sync drives the same button.
import { test, expect, type Page } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { openApp } from './support/app'
import { FAKE_PASSWORD, FAKE_USER } from './fake/caldav'

const setView = (page: Page, view: string) => page.evaluate((v) => (window as any).__optimo.ui.getState().set({ view: v, mobileTab: 'board' }), view)
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }
const axe = async (page: Page) => (await new AxeBuilder({ page }).analyze()).violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))
const at = (h: number) => {
  const d = new Date()
  d.setHours(h, 0, 0, 0)
  return d.toISOString()
}

async function connect(page: Page) {
  await setView(page, 'settings')
  const form = page.getByTestId('calendar-connect')
  await form.getByLabel('Apple ID').fill(FAKE_USER)
  await form.getByLabel('App-specific password').fill(FAKE_PASSWORD)
  await form.getByRole('button', { name: 'Connect iCloud' }).click()
  await expect(page.getByTestId('calendar-found')).toHaveText('Found 3 calendars')
  // the connect itself synced: its "Synced · …" clears back to "Sync now" after ~4 s
  await expect(page.getByTestId('calendar-sync')).toHaveText('Sync now', { timeout: 10_000 })
}

/** Hold the next calendar-sync call at the network until release(); later calls pass straight through. */
async function hold(page: Page) {
  let release!: () => void
  const gate = new Promise<void>((r) => (release = r))
  let held = 0
  await page.route('**/functions/v1/calendar-sync', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    held++
    await gate
    await route.fallback()
  })
  return { release, held: () => held }
}

async function shot(page: Page, state: string, project: string) {
  if (!process.env.EVIDENCE) return
  await page.getByTestId('calendars').evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await page.screenshot({ path: `docs/evidence/arc5a-slice-2-${state}-${project}.png` })
}

const doneRe = /^Synced · \d+ events? · \d+ sent to iCloud$/

test.describe('sync button feedback (arc 5a slice 2)', () => {
  test('pressed: Syncing… (disabled, busy) → Synced · N events · N sent to iCloud → Sync now after ~4 s', async ({ page, context }, info) => {
    test.setTimeout(60_000)
    const { errors } = await openApp(page, context)
    await connect(page)
    await expect(page.getByTestId('toast')).toHaveCount(0, { timeout: 15_000 }) // the "connected" toast would cover the actions
    const btn = page.getByTestId('calendar-sync')
    const live = page.getByTestId('calendar-sync-status')
    await expect(live).toHaveAttribute('aria-live', 'polite')

    const h = await hold(page)
    const response = page.waitForResponse((r) => r.url().includes('/functions/v1/calendar-sync') && r.request().method() === 'POST')
    await btn.click()
    await expect(btn).toHaveText('Syncing…')
    await expect(btn).toBeDisabled()
    await expect(btn).toHaveAttribute('aria-busy', 'true')
    await expect(btn.locator('.sync-spin')).toBeVisible()
    await expect(live).toContainText('Syncing calendars…')
    expect(h.held()).toBe(1)
    await shot(page, 'syncing', info.project.name)
    expect(await axe(page)).toEqual([])

    h.release()
    const body = await (await response).json()
    expect(body).toMatchObject({ events: expect.any(Number), pushed: 0 })
    expect(body.events).toBeGreaterThan(0)
    const want = `Synced · ${body.events} event${body.events === 1 ? '' : 's'} · 0 sent to iCloud`
    await expect(btn).toHaveText(want)
    await expect(btn).toBeEnabled()
    await expect(btn).toHaveAttribute('aria-busy', 'false')
    await expect(live).toHaveText(want)
    await shot(page, 'done', info.project.name)
    expect(await axe(page)).toEqual([])

    // ~4 s later, back to rest
    await expect(btn).toHaveText('Sync now', { timeout: 8_000 })
    await page.unroute('**/functions/v1/calendar-sync')
    expect(errors).toEqual([])
  })

  test('failure: red reason + Retry; Retry re-runs and succeeds', async ({ page, context }, info) => {
    test.setTimeout(60_000)
    const { server, errors } = await openApp(page, context)
    await connect(page)
    await expect(page.getByTestId('toast')).toHaveCount(0, { timeout: 15_000 })
    const btn = page.getByTestId('calendar-sync')
    const calls = () => server.functionCalls.filter((c) => c.name === 'calendar-sync').length

    let failures = 0
    await page.route('**/functions/v1/calendar-sync', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      failures++
      await route.fulfill({ status: 500, headers: cors, body: JSON.stringify({ error: 'iCloud didn’t answer in time' }) })
    })
    await btn.click()
    const reason = page.getByTestId('calendar-sync-error')
    await expect(reason).toHaveText('iCloud didn’t answer in time.')
    await expect(reason).toHaveCSS('color', await page.evaluate(() => {
      const probe = document.createElement('span')
      probe.style.color = 'var(--danger-ink)'
      document.body.append(probe)
      const c = getComputedStyle(probe).color
      probe.remove()
      return c
    }))
    await expect(btn).toHaveText('Retry')
    await expect(btn).toBeEnabled()
    await expect(page.getByTestId('calendar-sync-status')).toContainText('iCloud didn’t answer in time.')
    expect(failures).toBe(1)
    await shot(page, 'failed', info.project.name)
    expect(await axe(page)).toEqual([])

    // Retry → the real handler this time
    await page.unroute('**/functions/v1/calendar-sync')
    const before = calls()
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(btn).toHaveText(doneRe)
    await expect(reason).toHaveCount(0)
    expect(calls()).toBe(before + 1)
    expect(errors.filter((e) => !/500|Failed to load resource/.test(e))).toEqual([])
  })

  test('automatic: the after-push sync shows Syncing… then Synced · N events · 1 sent to iCloud on the button', async ({ page, context }) => {
    test.setTimeout(60_000)
    const { server, errors } = await openApp(page, context)
    await connect(page)
    const btn = page.getByTestId('calendar-sync')
    const h = await hold(page)
    // no click: a scheduled task is pushed, then ~5 s later the app asks calendar-sync to write it to iCloud
    await page.evaluate(async (start) => (window as any).__optimo.repo.createTask({ title: 'Swim, 40 lengths', start_at: start, duration_min: 45 }), at(18))
    await expect.poll(h.held, { timeout: 15_000 }).toBe(1)
    await expect(btn).toHaveText('Syncing…')
    await expect(btn).toBeDisabled()
    h.release()
    await expect(btn).toHaveText(/^Synced · \d+ events? · 1 sent to iCloud$/)
    expect(server.calLinks.size).toBe(1)
    await expect(btn).toHaveText('Sync now', { timeout: 8_000 })
    await page.unroute('**/functions/v1/calendar-sync')
    expect(errors).toEqual([])
  })
})
