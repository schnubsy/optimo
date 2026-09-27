// iCloud calendar accounts: connect through the calendar-connect Edge Function (the app-specific password is posted
// once, encrypted server-side, never stored on the device), read the secret-free view, toggle calendars, disconnect.
import { FunctionsHttpError } from '@supabase/supabase-js'
import { db } from '../data/db'
import type { CalendarAccount } from '../data/types'
import { supabase } from '../sync/remote'
import { activeEngine } from '../sync/engine'

function client() {
  const sb = supabase()
  if (!sb) throw new Error('Calendars need the synced app (sign in first).')
  return sb
}

async function fnError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json()
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

export async function setCalendarEnabled(acc: CalendarAccount, href: string, enabled: boolean) {
  const calendars = acc.calendars.map((c) => (c.href === href ? { ...c, enabled } : c))
  const { error } = await client().from('planner_calendar_accounts').update({ calendars }).eq('id', acc.id)
  if (error) throw new Error(error.message)
  return calendars
}

export async function disconnect(acc: CalendarAccount) {
  const { error } = await client().from('planner_calendar_accounts').delete().eq('id', acc.id)
  if (error) throw new Error(error.message)
  // the cascade delete removes the server rows without a sync-log entry — drop this device's copies directly
  await db.events.where('account_id').equals(acc.id).delete()
}

/** Refresh from iCloud (server side), then pull the changed events through the sync log. */
export async function syncCalendars(): Promise<void> {
  const { error } = await client().functions.invoke('calendar-sync', { body: {} })
  if (error) throw await fnError(error)
  await activeEngine?.run()
}

/** Drop local events whose account no longer exists (disconnected on another device). */
export async function pruneEvents(accounts: CalendarAccount[]) {
  const ids = new Set(accounts.map((a) => a.id))
  await db.events.filter((e) => !ids.has(e.account_id)).delete()
}
