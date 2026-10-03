// arc 5a slice 2 — one shared state for every calendar sync (the Settings button, the after-push trigger, the
// interval / visibility / mount runs): idle → syncing → done{events,pushed,at} (back to idle after 4 s) | failed{reason}.
// The reducer is pure; the store adds the 4 s auto-clear.
import { create } from 'zustand'

export const DONE_CLEAR_MS = 4_000

export type SyncStatus =
  | { kind: 'idle' }
  | { kind: 'syncing' }
  | { kind: 'done'; events: number; pushed: number; at: number }
  | { kind: 'failed'; reason: string }

export type SyncAction =
  | { type: 'start' }
  | { type: 'done'; events: number; pushed: number; at: number }
  | { type: 'fail'; reason: string }
  | { type: 'clear'; at: number } // only clears the done it was scheduled for

export const IDLE: SyncStatus = { kind: 'idle' }

export function reduce(s: SyncStatus, a: SyncAction): SyncStatus {
  switch (a.type) {
    case 'start':
      return s.kind === 'syncing' ? s : { kind: 'syncing' } // a start while syncing is ignored; retry = start from failed
    case 'done':
      return s.kind === 'syncing' ? { kind: 'done', events: a.events, pushed: a.pushed, at: a.at } : s
    case 'fail':
      return { kind: 'failed', reason: a.reason } // a failure outside a run (e.g. autosync listing accounts) still shows
    case 'clear':
      return s.kind === 'done' && s.at === a.at ? IDLE : s
  }
}

const NO_CALENDARS = 'No calendars found on this Apple ID'
/** #58: the account's own empty state explains this one; the sync button stays quiet about it ("Sync again") */
export const NO_CALENDARS_REASON = 'No calendars found on this Apple ID.'
const OFFLINE = 'Couldn’t reach the calendar service — check your connection and try again.'

/** Short, plain copy for whatever went wrong (a server code, a server message, a network failure). */
export function reasonFor(err: unknown): string {
  const raw = (typeof err === 'string' ? err : err instanceof Error ? err.message : '').trim()
  const name = err instanceof Error ? err.name : ''
  if (!raw && !name) return 'Calendar sync failed — try again.'
  if (raw === 'NO_CALENDARS' || raw.startsWith(NO_CALENDARS)) return NO_CALENDARS_REASON
  if (raw === 'not_connected' || /isn.t connected/i.test(raw)) return 'Calendar sync isn’t set up on the server yet.'
  if (name === 'FunctionsFetchError' || name === 'FunctionsRelayError' || /failed to fetch|network|load failed|fetch failed/i.test(raw)) return OFFLINE
  if (!raw) return 'Calendar sync failed — try again.'
  return /[.!?]$/.test(raw) ? raw : `${raw}.`
}

interface Store {
  status: SyncStatus
  start: () => void
  done: (r: { events: number; pushed: number }) => void
  fail: (err: unknown) => void
  reset: () => void
}

let clearTimer: ReturnType<typeof setTimeout> | null = null

export const useSyncStatus = create<Store>((set, get) => {
  const dispatch = (a: SyncAction) => set({ status: reduce(get().status, a) })
  return {
    status: IDLE,
    start: () => dispatch({ type: 'start' }),
    done: ({ events, pushed }) => {
      const at = Date.now()
      dispatch({ type: 'done', events, pushed, at })
      if (clearTimer) clearTimeout(clearTimer)
      clearTimer = setTimeout(() => {
        clearTimer = null
        dispatch({ type: 'clear', at })
      }, DONE_CLEAR_MS)
    },
    fail: (err) => dispatch({ type: 'fail', reason: reasonFor(err) }),
    reset: () => {
      if (clearTimer) clearTimeout(clearTimer)
      clearTimer = null
      set({ status: IDLE })
    },
  }
})

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`
/** "Synced · 3 events · 1 sent to iCloud" */
export const doneText = (events: number, pushed: number) => `Synced · ${plural(events, 'event')} · ${pushed} sent to iCloud`
