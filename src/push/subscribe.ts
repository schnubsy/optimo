// Web push on the installed PWA (iPhone: Home Screen app, iOS 16.4+) and desktop browsers. Permission → subscribe
// with the VAPID public key → planner_push_subscriptions row. In-app reminders stay the fallback when push is off.
import { updateSettings } from '../data/repo'
import { removeSubscription, saveSubscription } from './api'

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
const FLAG = 'optimo.push'

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on'

const b64urlToBytes = (s: string) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent)
const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

/** Whether this device can have push right now, and whether it is on. */
export async function pushState(): Promise<PushState> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined' || !VAPID) {
    // iPhone Safari only exposes push inside the Home Screen app
    return isIos() && !standalone() ? 'needs-install' : 'unsupported'
  }
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub && localStorage.getItem(FLAG) === 'on' ? 'on' : 'off'
}

/** Push is delivering reminders on this device (the in-app scheduler then stays quiet to avoid doubles). */
export const pushOn = () => {
  try {
    return localStorage.getItem(FLAG) === 'on'
  } catch {
    return false
  }
}

export async function enablePush(): Promise<PushState> {
  if (!VAPID) return 'unsupported'
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off'
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToBytes(VAPID) }))
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  await saveSubscription({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, ua: navigator.userAgent.slice(0, 200) })
  // the server works out series occurrences in the user's own wall-clock time
  await updateSettings({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone })
  localStorage.setItem(FLAG, 'on')
  return 'on'
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await removeSubscription(sub.endpoint).catch(() => undefined)
    await sub.unsubscribe()
  }
  localStorage.removeItem(FLAG)
  return 'off'
}

/** A local notification through the service worker — proves permission + display without a server round trip. */
export async function testNotification() {
  const reg = await navigator.serviceWorker.ready
  await reg.showNotification('optimo', { body: 'Reminders will arrive like this.', tag: 'optimo-test', icon: '/optimo/icons/icon-192.png', data: { url: '/optimo/' } })
}
