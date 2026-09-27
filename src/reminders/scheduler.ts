// In-app reminders (v0.1): while the app is open, fire each reminder once at start − offset.
// Uses the Notification API when permission is granted, otherwise an in-app toast. No push (arc 2).

import { loadItems } from '../timeline/items'
import { todayKey } from '../lib/time'
import { useUI } from '../state/ui'

const FIRED_KEY = 'optimo.reminders.fired'

function fired(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}
function remember(s: Set<string>) {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify([...s].slice(-500)))
  } catch {
    /* ignore */
  }
}

/** Reminders due in (lastCheck, now]: key = item key + offset. Pure for tests. */
export function dueReminders(items: { key: string; task: { title: string; start_at: string | null; reminders: number[]; completed_at: string | null } }[], lastCheck: number, now: number) {
  const out: { id: string; title: string; offset: number; at: number }[] = []
  for (const i of items) {
    if (!i.task.start_at || i.task.completed_at) continue
    const start = new Date(i.task.start_at).getTime()
    for (const off of i.task.reminders) {
      const at = start - off * 60_000
      if (at > lastCheck && at <= now) out.push({ id: `${i.key}:${off}`, title: i.task.title, offset: off, at })
    }
  }
  return out
}

export function startReminders(): () => void {
  let last = Date.now() - 30_000
  const tick = async () => {
    const now = Date.now()
    const day = todayKey()
    const items = (await loadItems([day]))[day] ?? []
    const done = fired()
    for (const r of dueReminders(items, last, now)) {
      if (done.has(r.id)) continue
      done.add(r.id)
      const text = r.offset ? `${r.title} starts in ${r.offset} min` : `${r.title} is starting`
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification('optimo', { body: text, tag: r.id })
        } catch {
          useUI.getState().notify({ text })
        }
      } else useUI.getState().notify({ text })
    }
    remember(done)
    last = now
  }
  const t = setInterval(() => void tick(), 30_000)
  void tick()
  return () => clearInterval(t)
}
