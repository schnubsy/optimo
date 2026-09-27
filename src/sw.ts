/// <reference lib="webworker" />
// optimo's service worker (vite-plugin-pwa injectManifest): the precached offline shell, exactly as the generated
// SW did before arc 2, plus web push — reminders arrive as notifications on the installed PWA (iPhone) and desktop.
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { clientsClaim } from 'workbox-core'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] }

// registerType 'autoUpdate': take over as soon as a new build installs
self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
registerRoute(new NavigationRoute(createHandlerBoundToURL('/optimo/index.html')))
// Supabase traffic is never cached by the SW: the outbox owns offline writes.
registerRoute(({ url }) => url.origin === 'https://fonts.googleapis.com', new StaleWhileRevalidate({ cacheName: 'google-fonts-css' }))
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 365 * 24 * 3600 }), new CacheableResponsePlugin({ statuses: [0, 200] })],
  }),
)

/** Payload from push-send: { title, body: "in 10 min · 14:00", tag: task id, url: the day } */
interface PushPayload {
  title: string
  body: string
  tag?: string
  url?: string
}

self.addEventListener('push', (event) => {
  let p: PushPayload
  try {
    p = event.data?.json() as PushPayload
  } catch {
    p = { title: 'optimo', body: event.data?.text() ?? '' }
  }
  event.waitUntil(
    self.registration.showNotification(p.title || 'optimo', {
      body: p.body,
      tag: p.tag,
      icon: '/optimo/icons/icon-192.png',
      badge: '/optimo/icons/icon-192.png',
      data: { url: p.url ?? '/optimo/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data as { url?: string } | null)?.url ?? '/optimo/', self.location.origin).href
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const win = wins.find((w) => new URL(w.url).pathname.startsWith('/optimo/'))
      if (win) {
        // focus the open app and tell it which day to show (Planner listens for this message)
        win.postMessage({ type: 'optimo:open', url })
        await win.focus()
      } else await self.clients.openWindow(url)
    })(),
  )
})
