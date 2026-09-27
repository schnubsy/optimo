// Arc 2 slice 5 — web push, in Chromium with the real service worker (SW routing is Chromium-only in Playwright,
// lessons 2026-09-26 [pwa]): Settings → Reminders → permission → subscribe → planner_push_subscriptions row; a push
// delivered to the SW (CDP ServiceWorker.deliverPushMessage) shows the notification; the click deep-links the day.
import { writeFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { openApp } from './support/app'

// full Chromium (new headless): the default headless shell reports Notification.permission 'denied' even when granted
test.use({ channel: 'chromium' })

test.describe('web push reminders', () => {
  test.use({ serviceWorkers: 'allow' })
  test.skip(({ browserName }) => browserName !== 'chromium', 'push is exercised in Chromium (desktop); iPhone uses the same SW once installed')

  test('enable → subscription row → a delivered push shows the notification → test notification → off', async ({ page, context, baseURL }) => {
    await context.grantPermissions(['notifications'], { origin: new URL(baseURL!).origin })
    // headless Chromium has no push service (FCM): stand in for PushManager.subscribe, keeping the real SW + showNotification
    await context.addInitScript(() => {
      const fake = {
        endpoint: 'https://push.example.test/send/abc123',
        toJSON: () => ({ endpoint: 'https://push.example.test/send/abc123', keys: { p256dh: 'BPk3yLq2', auth: 'x9Tq' } }),
        unsubscribe: async () => true,
      }
      let current: typeof fake | null = null
      PushManager.prototype.subscribe = async function () {
        current = fake
        return fake as unknown as PushSubscription
      }
      PushManager.prototype.getSubscription = async function () {
        return current as unknown as PushSubscription
      }
    })
    const { server, errors } = await openApp(page, context)
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.evaluate(() => (window as any).__optimo.ui.getState().set({ view: 'settings' }))
    const box = page.getByTestId('reminders')
    await expect(box).toHaveAttribute('data-state', 'off')
    await box.getByTestId('push-enable').click()
    await expect(box).toHaveAttribute('data-state', 'on')
    await expect.poll(() => [...server.rows.planner_push_subscriptions.values()].map((r) => r.endpoint)).toEqual(['https://push.example.test/send/abc123'])
    const row = server.rows.planner_push_subscriptions.get('https://push.example.test/send/abc123')!
    expect(row).toMatchObject({ p256dh: 'BPk3yLq2', auth: 'x9Tq' })
    // the server expands series in this zone
    await expect.poll(() => page.evaluate(async () => (await (window as any).__optimo.db.settings.get('me'))?.data?.tz)).toBeTruthy()

    // a real push event into the real SW → a notification with push-send's payload
    const cdp = await context.newCDPSession(page)
    await cdp.send('ServiceWorker.enable')
    const reg = await new Promise<{ registrationId: string; scopeURL: string }>((resolve) => {
      cdp.on('ServiceWorker.workerRegistrationUpdated', (e: { registrations: { registrationId: string; scopeURL: string; isDeleted: boolean }[] }) => {
        const r = e.registrations.find((x) => x.scopeURL.endsWith('/optimo/') && !x.isDeleted)
        if (r) resolve(r)
      })
    })
    const data = JSON.stringify({ title: 'Stand-up', body: 'in 10 min · 09:00', tag: 'task-1', url: '/optimo/?date=2026-09-28' })
    await cdp.send('ServiceWorker.deliverPushMessage', { origin: new URL(baseURL!).origin, registrationId: reg.registrationId, data })
    await expect
      .poll(() => page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => `${n.title}|${n.body}|${n.tag}|${n.data?.url}`)))
      .toContain('Stand-up|in 10 min · 09:00|task-1|/optimo/?date=2026-09-28')
    if (process.env.EVIDENCE) {
      const shown = await page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => ({ title: n.title, body: n.body, tag: n.tag, icon: n.icon, data: n.data })))
      writeFileSync('docs/evidence/arc2-slice-5-notification.json', JSON.stringify({ delivered: JSON.parse(data), shownByServiceWorker: shown }, null, 2) + '\n')
    }

    // the app follows the message the SW's notificationclick posts (clicks can't be synthesised on OS notifications)
    await page.evaluate(async () => {
      const ev = new MessageEvent('message', { data: { type: 'optimo:open', url: '/optimo/?date=2026-09-28' } })
      navigator.serviceWorker.dispatchEvent(ev)
    })
    await expect.poll(() => page.evaluate(() => (window as any).__optimo.ui.getState().date)).toBe('2026-09-28')

    // test notification (local, through the SW)
    await page.evaluate(() => (window as any).__optimo.ui.getState().set({ view: 'settings' }))
    await box.getByTestId('push-test').click()
    await expect.poll(() => page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications({ tag: 'optimo-test' })).length)).toBe(1)

    // off removes the row
    await box.getByTestId('push-disable').click()
    await expect(box).toHaveAttribute('data-state', 'off')
    await expect.poll(() => server.rows.planner_push_subscriptions.size).toBe(0)
    expect(errors).toEqual([])
  })

  test('evidence: Settings → Reminders', async ({ page, context, baseURL }) => {
    test.skip(!process.env.EVIDENCE, 'set EVIDENCE=1 to refresh docs/evidence screenshots')
    await context.grantPermissions(['notifications'], { origin: new URL(baseURL!).origin })
    await context.addInitScript(() => {
      const fake = { endpoint: 'https://push.example.test/e', toJSON: () => ({ endpoint: 'https://push.example.test/e', keys: { p256dh: 'k', auth: 'a' } }), unsubscribe: async () => true }
      let cur: unknown = null
      PushManager.prototype.subscribe = async () => ((cur = fake), fake as unknown as PushSubscription)
      PushManager.prototype.getSubscription = async () => cur as PushSubscription
    })
    await openApp(page, context, { theme: 'light' })
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.evaluate(() => (window as any).__optimo.ui.getState().set({ view: 'settings' }))
    await page.getByTestId('push-enable').click()
    await expect(page.getByTestId('reminders')).toHaveAttribute('data-state', 'on')
    await page.getByTestId('reminders').scrollIntoViewIfNeeded()
    await page.screenshot({ path: 'docs/evidence/arc2-slice-5-reminders-desktop.png' })
  })
})
