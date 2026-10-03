// arc 4 — push optimo edits to iCloud quickly: after the outbox has pushed task changes, ask calendar-sync to run
// (debounced ~5 s, so a burst of drags is one sync). Only when an account has a write target (checked when the timer
// fires — one small read per burst); the pg_cron run every 15 min stays the backstop for devices that are closed.
import { listAccounts, syncCalendars } from './api'

export const PUSH_DEBOUNCE_MS = 5_000

let timer: ReturnType<typeof setTimeout> | null = null

/** Called after the sync engine pushed task rows. */
export function scheduleCalendarPush(delay = PUSH_DEBOUNCE_MS) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(async () => {
    timer = null
    if (!navigator.onLine) return
    try {
      if ((await listAccounts()).some((a) => a.enabled && !!a.write_calendar_href)) await syncCalendars()
    } catch {
      /* Settings shows last_error; the next push or the cron retries */
    }
  }, delay)
}

export function cancelCalendarPush() {
  if (timer) clearTimeout(timer)
  timer = null
}
