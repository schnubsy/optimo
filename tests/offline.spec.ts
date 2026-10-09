// Offline end to end: load online → offline → create / move / complete → reload offline (service worker shell +
// IndexedDB) → online → outbox flushes → a second device pulls the rows. Plus PWA installability.
import { test, expect } from '@playwright/test'
import { openApp, row, seedDay } from './support/app'
import { FakeSupabase } from './support/fakeSupabase'

test.describe('offline PWA', () => {
  test.use({ serviceWorkers: 'allow' })
  test.skip(({ browserName }) => browserName !== 'chromium', 'service-worker offline is exercised in Chromium; iPhone Safari installs the same SW')

  test('works fully offline and syncs on reconnect', async ({ page, context, browser, baseURL }) => {
    let s: ReturnType<typeof seedDay>
    const { server, errors } = await openApp(page, context, { seed: (x) => (s = seedDay(x)) })
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload() // now controlled by the SW
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
    await expect(page.getByTestId('sync-badge')).toHaveAttribute('data-state', 'synced')

    await context.setOffline(true)
    await expect(page.getByTestId('sync-badge')).toHaveAttribute('data-state', 'offline')
    // create
    await page.getByTestId('quickadd').fill('Written on a plane at 3pm')
    await page.getByTestId('quickadd').press('Enter')
    // move (keyboard nudge +5 min) and complete
    const lunch = page.locator(`[data-testid="block"][data-id="${s!.ids.lunch}"] [data-testid="chip"]`)
    await lunch.scrollIntoViewIfNeeded()
    await lunch.focus() // arc 6: focusing the chip selects (a tap opens the editor)
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Escape')
    const standup = page.locator(`[data-testid="block"][data-id="${s!.ids.standup}"]`)
    await standup.scrollIntoViewIfNeeded()
    await standup.getByRole('button', { name: /^Mark .* done$/ }).click()
    await expect(standup).toHaveClass(/done/)
    await expect.poll(async () => (await row(page, s!.ids.lunch)).start_at).toContain(':05:')
    await expect(page.getByTestId('sync-badge')).toContainText('queued')

    // reload while offline: the shell comes from the SW precache, data from IndexedDB
    await page.reload()
    await expect(page.locator('[data-testid="block"]', { hasText: 'Written on a plane' })).toHaveAttribute('data-start', String(15 * 60))
    expect(new Date((await row(page, s!.ids.lunch)).start_at).getMinutes()).toBe(5)
    expect((await row(page, s!.ids.standup)).completed_at).toBeTruthy()
    expect(server.task(s!.ids.standup)?.completed_at ?? null).toBeNull() // nothing reached the server yet

    // reconnect → outbox flush
    await context.setOffline(false)
    await expect(page.getByTestId('sync-badge')).toHaveAttribute('data-state', 'synced', { timeout: 10_000 })
    expect(server.task(s!.ids.standup)?.completed_at).toBeTruthy()
    expect(new Date(server.task(s!.ids.lunch)!.start_at as string).getMinutes()).toBe(5)

    // a second device pulls everything
    const ctxB = await browser.newContext({ baseURL })
    const other = new FakeSupabase()
    other.rows = server.rows
    other.log = server.log
    await other.attach(ctxB)
    const b = await ctxB.newPage()
    await b.goto('./')
    await expect(b.locator('[data-testid="block"]', { hasText: 'Written on a plane' })).toBeVisible({ timeout: 10_000 })
    await ctxB.close()
    expect(errors).toEqual([])
  })

  test('installable: manifest, icons and an active service worker; no installability errors', async ({ page, context }) => {
    await openApp(page, context)
    const manifest = await page.evaluate(async () => (await fetch(document.querySelector('link[rel=manifest]')!.getAttribute('href')!)).json())
    expect(manifest).toMatchObject({ name: expect.stringContaining('optimo'), short_name: 'optimo', display: 'standalone', start_url: '/optimo/', scope: '/optimo/' })
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']))
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true)
    for (const i of manifest.icons) expect((await page.request.get(`./${i.src}`)).status()).toBe(200)
    await page.evaluate(() => navigator.serviceWorker.ready)
    const cdp = await context.newCDPSession(page)
    const { installabilityErrors } = (await cdp.send('Page.getInstallabilityErrors')) as { installabilityErrors: unknown[] }
    expect(installabilityErrors).toEqual([])
  })
})
