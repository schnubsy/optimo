// arc 4 — iCloud two-way, end to end against the hermetic server: the app's outbox push → the debounced calendar-sync
// call → the REAL calendar-sync handler (in-process) → the iCloud-shaped CalDAV fake. Desktop + iPhone 15.
import { test, expect, type Page } from '@playwright/test'
import { openApp } from './support/app'
import { CAL, FAKE_PASSWORD, FAKE_USER } from './fake/caldav'
import type { FakeSupabase } from './support/fakeSupabase'

const setView = (page: Page, view: string) => page.evaluate((v) => (window as any).__optimo.ui.getState().set({ view: v, mobileTab: 'board' }), view)
async function connect(page: Page) {
  await setView(page, 'settings')
  const form = page.getByTestId('calendar-connect')
  await form.getByLabel('Apple ID').fill(FAKE_USER)
  await form.getByLabel('App-specific password').fill(FAKE_PASSWORD)
  await form.getByRole('button', { name: 'Connect iCloud' }).click()
  await expect(page.getByTestId('calendar-found')).toHaveText('Found 3 calendars')
}
const inICloud = (server: FakeSupabase, id: string) => server.caldav.objects(CAL.optimo).filter((o) => o.ics.includes(`UID:optimo-${id}@optimo`))
const summary = (ics: string) => /^SUMMARY:(.*)$/m.exec(ics)?.[1]?.trim()
const at = (h: number) => {
  const d = new Date()
  d.setHours(h, 0, 0, 0)
  return d.toISOString()
}

test.describe('iCloud two-way (arc 4)', () => {
  test('push: a task created, edited, then deleted in optimo follows into the chosen iCloud calendar', async ({ page, context }) => {
    test.setTimeout(60_000)
    const { server, errors } = await openApp(page, context)
    await connect(page)
    const syncsBefore = server.functionCalls.filter((c) => c.name === 'calendar-sync').length
    const id = await page.evaluate(async (start) => (await (window as any).__optimo.repo.createTask({ title: 'Swim, 40 lengths', start_at: start, duration_min: 45 })).id, at(18))
    // the outbox pushes the task, then ~5 s later the app asks calendar-sync to write it to iCloud
    await expect.poll(() => inICloud(server, id).length, { timeout: 15_000 }).toBe(1)
    expect(summary(inICloud(server, id)[0].ics)).toBe('Swim\\, 40 lengths')
    expect(server.functionCalls.filter((c) => c.name === 'calendar-sync').length).toBe(syncsBefore + 1) // debounced: one call
    expect(server.calLinks.get(id)).toMatchObject({ uid: `optimo-${id}@optimo` })
    // never shown twice: the object is not cached as a calendar event
    expect(await page.evaluate(() => (window as any).__optimo.db.events.filter((e: { uid: string }) => e.uid.startsWith('optimo-')).count())).toBe(0)

    await page.evaluate(async (i) => (window as any).__optimo.repo.updateTask(i, { title: 'Swim, 50 lengths' }), id)
    await expect.poll(() => summary(inICloud(server, id)[0]?.ics ?? ''), { timeout: 15_000 }).toBe('Swim\\, 50 lengths')

    await page.evaluate(async (i) => (window as any).__optimo.repo.deleteTask(i), id)
    await expect.poll(() => inICloud(server, id).length, { timeout: 15_000 }).toBe(0)
    expect(server.calLinks.size).toBe(0)
    expect(errors).toEqual([])
  })
})
