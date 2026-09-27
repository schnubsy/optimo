// Service worker: precached app shell so optimo opens and works fully offline (docs/spec.md §2.8).
import { registerSW } from 'virtual:pwa-register'

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  // after load, so SW install never competes with first paint
  const go = () => registerSW({ immediate: true })
  if (document.readyState === 'complete') go()
  else window.addEventListener('load', go, { once: true })
}
