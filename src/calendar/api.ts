// iCloud calendar accounts: connect through the calendar-connect Edge Function (the app-specific password is posted
// once, encrypted server-side, never stored on the device), read the secret-free view, toggle calendars, disconnect.
import { FunctionsHttpError } from '@supabase/supabase-js'
import { db } from '../data/db'
import type { CalendarAccount } from '../data/types'
import { supabase } from '../sync/remote'
import { activeEngine } from '../sync/engine'
import { useSyncStatus } from './syncStatus'

function client() {
  const sb = supabase()
  if (!sb) throw new Error('Calendars need the synced app (sign in first).')
  return sb
}

async function fnError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json()
      if (body?.code === 'not_connected') return new Error('not_connected')
      if (body?.error) return new Error(body.error)
    } catch {
      /* not JSON */
    }
  }
  return new Error('Couldn’t reach the calendar service — try again.')
}

export async function listAccounts(): Promise<CalendarAccount[]> {
  const { data, error } = await client().from('planner_calendar_accounts_public').select('*').order('created_at')
  if (error) throw new Error(error.message)
  return (data ?? []) as CalendarAccount[]
}

export async function connectICloud(input: { username: string; password: string; label?: string }): Promise<CalendarAccount> {
  const { data, error } = await client().functions.invoke('calendar-connect', { body: input })
  if (error) throw await fnError(error)
  return data as CalendarAccount
}

/**
 * Store a calendar's role (Off · Show in optimo · Two-way, see roles.ts) — the calendars list and the write target in
 * ONE update, so a role change is never half-applied.
 */
export async function setCalendarRole(acc: CalendarAccount, patch: Pick<CalendarAccount, 'calendars'> & { write_calendar_href: string | null }) {
  const { error } = await client()
    .from('planner_calendar_accounts')
    .update({ calendars: patch.calendars, write_calendar_href: patch.write_calendar_href })
    .eq('id', acc.id)
  if (error) throw new Error(error.message)
}

export async function disconnect(acc: CalendarAccount) {
  const { error } = await client().from('planner_calendar_accounts').delete().eq('id', acc.id)
  if (error) throw new Error(error.message)
  // the cascade delete removes the server rows without a sync-log entry — drop this device's copies directly
  await db.events.where('account_id').equals(acc.id).delete()
}

export interface SyncTotals {
  events: number
  pushed: number
}
type SyncResponse = { accounts?: { error?: string; events?: number; twoWay?: { pushed?: number } }[]; events?: number; pushed?: number }

/** Totals from calendar-sync's response; an older server without the top-level fields is summed from accounts[]. */
export function totalsOf(data: unknown): SyncTotals {
  const d = (data ?? {}) as SyncResponse
  const accs = Array.isArray(d.accounts) ? d.accounts : []
  return {
    events: typeof d.events === 'number' ? d.events : accs.reduce((n, a) => n + (a.events ?? 0), 0),
    pushed: typeof d.pushed === 'number' ? d.pushed : accs.reduce((n, a) => n + (a.twoWay?.pushed ?? 0), 0),
  }
}

let inFlight: Promise<SyncTotals> | null = null
let queued: Promise<SyncTotals> | null = null

/** Refresh from iCloud (server side), then pull the changed events through the sync log. Every caller (the Settings
 * button, the after-push trigger, the interval / visibility / mount runs) drives the one shared status. A call made
 * while a sync is running queues ONE follow-up run (calls coalesce into it) — the settings or tasks it was made for may
 * have changed after the running one started — and the status stays "syncing" until the last run settles.
 * HTTP/network failures throw (status → failed); an account the server could not sync (e.g. no calendars) resolves
 * but leaves the status failed with that reason. */
export function syncCalendars(): Promise<SyncTotals> {
  if (inFlight) {
    queued ??= inFlight
      .catch(() => undefined)
      .then(() => {
        queued = null
        return run()
      })
    return queued
  }
  return run()
}

function run(): Promise<SyncTotals> {
  const status = useSyncStatus.getState()
  status.start()
  inFlight = (async () => {
    try {
      const { data, error } = await client().functions.invoke('calendar-sync', { body: {} })
      if (error) throw await fnError(error)
      await activeEngine?.run()
      const totals = totalsOf(data)
      const failed = (data as SyncResponse | null)?.accounts?.find((a) => a.error)
      if (queued) return totals // a follow-up is queued: it reports
      if (failed) status.fail(failed.error)
      else status.done(totals)
      return totals
    } catch (err) {
      if (!queued) status.fail(err)
      throw err
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}

/** Drop local events whose account no longer exists (disconnected on another device). */
export async function pruneEvents(accounts: CalendarAccount[]) {
  const ids = new Set(accounts.map((a) => a.id))
  await db.events.filter((e) => !ids.has(e.account_id)).delete()
}
