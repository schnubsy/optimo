import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import type { CalendarEvent } from '../data/types'
import { dayRange, minutesInDay } from '../lib/time'
import { listAccounts, pruneEvents, syncCalendars } from './api'

/** A calendar event placed on one day: minutes after local midnight, clipped to the day. */
export interface EventItem {
  key: string
  event: CalendarEvent
  start: number
  end: number
}

export function eventsForDay(events: CalendarEvent[], day: string): EventItem[] {
  const [a, b] = dayRange(day).map((x) => new Date(x).getTime())
  return events
    .filter((e) => !e.deleted_at && new Date(e.start_at).getTime() < b && new Date(e.end_at).getTime() > a)
    .map((e) => ({
      key: `ev:${e.id}`,
      event: e,
      start: Math.max(0, minutesInDay(e.start_at, day)),
      end: Math.min(1440, Math.max(minutesInDay(e.end_at, day), minutesInDay(e.start_at, day) + 5)),
    }))
}

/** Live events overlapping the given days (keyed by day). */
export function useEvents(days: string[]): Record<string, EventItem[]> {
  const k = days.join(',')
  const rows = useLiveQuery(async () => {
    if (!days.length) return []
    const from = new Date(new Date(dayRange(days[0])[0]).getTime() - 86_400_000).toISOString()
    const to = dayRange(days[days.length - 1])[1]
    return db.events.where('start_at').between(from, to, true, false).toArray()
  }, [k])
  return Object.fromEntries(days.map((d) => [d, eventsForDay(rows ?? [], d)]))
}

const EVERY = 15 * 60_000

/** On app open and every 15 min while visible: refresh iCloud server-side, then pull (only if an account exists). */
export function useCalendarSync(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    let stopped = false
    const run = async () => {
      if (stopped || document.visibilityState !== 'visible') return
      try {
        const accounts = await listAccounts()
        await pruneEvents(accounts)
        if (accounts.some((a) => a.enabled)) await syncCalendars()
      } catch {
        /* offline or not configured — the next tick retries; Settings shows last_error */
      }
    }
    void run()
    const t = setInterval(run, EVERY)
    const onVis = () => document.visibilityState === 'visible' && void run()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      stopped = true
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [enabled])
}
