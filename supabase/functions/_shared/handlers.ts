// calendar-connect / calendar-sync as plain Request → Response handlers over ports, so the Deno entry points
// (…/index.ts, service-role supabase-js) and the hermetic test fake (tests/support/fakeSupabase.ts) run the same code.
import { CalDav, CalDavAuthError, type DavCalendar, type Fetch } from './caldav.ts'
import { decryptSecret, encryptSecret, importKek } from './crypto.ts'
import { parseIcs } from './ics.ts'
import { NO_TWO_WAY, twoWay, type SeenObject, type TwoWayPorts, type TwoWayResult } from './twoway.ts'
import { taskIdOf } from './vevent.ts'

export const ICLOUD = 'https://caldav.icloud.com/'
export const WINDOW_BACK_DAYS = 7
export const WINDOW_AHEAD_DAYS = 60

export interface AccountRow {
  id: string
  user_id: string
  provider: 'icloud'
  label: string
  username: string
  secret_enc: string
  principal_url: string | null
  calendars: DavCalendar[]
  enabled: boolean
  last_sync_at: string | null
  last_error: string | null
  /** the one calendar optimo writes timed tasks into (db/005); null = write-back off */
  write_calendar_href: string | null
}
export type PublicAccount = Omit<AccountRow, 'secret_enc'>
export interface EventRow {
  account_id: string
  user_id: string
  calendar_href: string
  uid: string
  etag: string | null
  title: string
  location: string | null
  start_at: string
  end_at: string
  all_day: boolean
  status: string | null
  color: string | null
  deleted_at: string | null
}

/** What a handler needs from the platform — service-role DB access, auth, config, network. */
export interface Ports extends TwoWayPorts {
  kek: string // PLANNER_KEK
  cronSecret: string // CRON_SECRET
  fetch: Fetch
  userFromJwt(jwt: string): Promise<string | null>
  insertAccount(row: AccountRow): Promise<void>
  accounts(userId: string | null): Promise<AccountRow[]> // null = every user (cron)
  updateAccount(id: string, patch: Partial<AccountRow>): Promise<void>
  /** live (non-deleted) events of an account: key → etag|start|end|title for change detection */
  eventKeys(accountId: string): Promise<Map<string, string>>
  upsertEvents(rows: EventRow[]): Promise<void>
  tombstoneEvents(accountId: string, keys: string[]): Promise<void>
  log?(msg: string): void
  newId(): string
}

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'access-control-allow-methods': 'POST, OPTIONS',
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })
const bearer = (req: Request) => req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
export const eventKey = (calendarHref: string, uid: string) => `${calendarHref}\u0000${uid}`
const publicRow = ({ secret_enc: _s, ...rest }: AccountRow): PublicAccount => rest
export const NO_CALENDARS = 'No calendars found on this Apple ID'

/**
 * Fold a fresh discovery into the stored list: known calendars keep their `enabled` choice, new ones arrive enabled,
 * vanished ones go. A calendar named "optimo" that is NEW in this discovery becomes the write target when none is set
 * — on first connect and on the first sync that finds it — but never overrides a later explicit "None".
 */
export function mergeCalendars(prev: DavCalendar[], found: DavCalendar[], writeHref: string | null): { calendars: DavCalendar[]; write_calendar_href: string | null } {
  const was = new Map(prev.map((c) => [c.href, c]))
  const calendars = found.map((c) => ({ ...c, enabled: was.get(c.href)?.enabled ?? true }))
  let write = writeHref && calendars.some((c) => c.href === writeHref && c.writable !== false) ? writeHref : null
  if (!writeHref) write = calendars.find((c) => !was.has(c.href) && c.name.trim().toLowerCase() === 'optimo' && c.writable !== false)?.href ?? null
  return { calendars, write_calendar_href: write }
}

async function discover(dav: CalDav): Promise<{ principal: string; calendars: DavCalendar[] }> {
  const principal = await dav.principal()
  return { principal, calendars: await dav.calendars(await dav.homeSet(principal)) }
}

/** POST {username, password, label} (user JWT) → discover calendars, store the encrypted password, return the public row. */
export async function handleConnect(req: Request, p: Ports): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'POST only' })
  const userId = await p.userFromJwt(bearer(req))
  if (!userId) return json(401, { error: 'Sign in first.' })
  let body: { username?: string; password?: string; label?: string }
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Expected JSON.' })
  }
  const username = (body.username ?? '').trim()
  const password = (body.password ?? '').replace(/\s/g, '') // Apple shows app-specific passwords as xxxx-xxxx-xxxx-xxxx
  if (!username || !password) return json(400, { error: 'Apple ID and app-specific password are both needed.' })
  const dav = new CalDav(ICLOUD, CalDav.basic(username, password), p.fetch)
  let found: { principal: string; calendars: DavCalendar[] }
  try {
    found = await discover(dav)
  } catch (e) {
    // never log the password — only the failure class
    if (e instanceof CalDavAuthError) return json(401, { error: 'iCloud didn’t accept that Apple ID and app-specific password.' })
    p.log?.(`calendar-connect: discovery failed (${(e as Error).message})`)
    return json(502, { error: 'Couldn’t reach iCloud Calendar — try again in a moment.' })
  }
  const { calendars, write_calendar_href } = mergeCalendars([], found.calendars, null)
  const row: AccountRow = {
    id: p.newId(),
    user_id: userId,
    provider: 'icloud',
    label: (body.label ?? '').trim() || 'iCloud',
    username,
    secret_enc: await encryptSecret(password, await importKek(p.kek)),
    principal_url: found.principal,
    calendars,
    enabled: true,
    last_sync_at: null,
    last_error: calendars.length ? null : NO_CALENDARS,
    write_calendar_href,
  }
  await p.insertAccount(row)
  return json(200, publicRow(row))
}

export interface SyncResult {
  upserted: number
  removed: number
  /** calendars discovered this sync, and live event instances cached for the account afterwards */
  calendars: number
  events: number
  /** two-way: what moved between optimo and the write calendar this sync */
  twoWay: TwoWayResult
}

/**
 * Sync one account: rediscover its calendars (iCloud adds/removes/shares them at any time), REPORT each enabled
 * calendar over [now−7d, now+60d], upsert changed instances, tombstone the rest.
 */
export async function syncAccount(acc: AccountRow, p: Ports, now = new Date()): Promise<SyncResult> {
  const from = new Date(now.getTime() - WINDOW_BACK_DAYS * 86_400_000)
  const to = new Date(now.getTime() + WINDOW_AHEAD_DAYS * 86_400_000)
  const password = await decryptSecret(acc.secret_enc, await importKek(p.kek))
  const dav = new CalDav(ICLOUD, CalDav.basic(acc.username, password), p.fetch)
  const found = await discover(dav)
  const merged = mergeCalendars(acc.calendars ?? [], found.calendars, acc.write_calendar_href ?? null)
  const patch: Partial<AccountRow> = { calendars: merged.calendars, principal_url: found.principal }
  if (merged.write_calendar_href !== (acc.write_calendar_href ?? null)) patch.write_calendar_href = merged.write_calendar_href
  await p.updateAccount(acc.id, patch)
  Object.assign(acc, patch)

  const existing = await p.eventKeys(acc.id)
  const seen = new Set<string>()
  const changed: EventRow[] = []
  const optimo = new Map<string, SeenObject>() // optimo's own objects, by UID — the two-way pass reads these
  for (const cal of acc.calendars) {
    // the write calendar is always read (for iCloud-side edits), even with its events toggled off
    if (!cal.enabled && cal.href !== acc.write_calendar_href) continue
    for (const obj of await dav.events(cal.href, from, to)) {
      for (const inst of parseIcs(obj.ics, from, to)) {
        if (taskIdOf(inst.uid)) {
          // a task optimo wrote: never cached as an event (the task already shows), only checked for edits
          optimo.set(inst.uid, { calendar: cal.href, href: dav.url(obj.href), etag: obj.etag, ics: obj.ics })
          continue
        }
        if (!cal.enabled) continue
        const k = eventKey(cal.href, inst.uid)
        seen.add(k)
        const sig = `${obj.etag}|${inst.start_at}|${inst.end_at}|${inst.title}`
        if (existing.get(k) === sig) continue
        changed.push({ account_id: acc.id, user_id: acc.user_id, calendar_href: cal.href, etag: obj.etag, color: cal.color, deleted_at: null, ...inst })
      }
    }
  }
  if (changed.length) await p.upsertEvents(changed)
  const gone = [...existing.keys()].filter((k) => !seen.has(k))
  if (gone.length) await p.tombstoneEvents(acc.id, gone)
  const two = acc.calendars.length ? await twoWay(dav, acc, p, optimo, from, now) : { ...NO_TWO_WAY }
  return { upserted: changed.length, removed: gone.length, calendars: acc.calendars.length, events: seen.size, twoWay: two }
}

/** POST (user JWT → that user's accounts; or x-cron-secret → every enabled account). */
export async function handleSync(req: Request, p: Ports): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'POST only' })
  const cron = req.headers.get('x-cron-secret')
  let userId: string | null = null
  if (cron) {
    if (!p.cronSecret || cron !== p.cronSecret) return json(401, { error: 'bad cron secret' })
  } else {
    userId = await p.userFromJwt(bearer(req))
    if (!userId) return json(401, { error: 'Sign in first.' })
  }
  const results: ({ id: string; error?: string } & Partial<SyncResult>)[] = []
  for (const acc of (await p.accounts(userId)).filter((a) => a.enabled)) {
    try {
      const r = await syncAccount(acc, p)
      // honest status: an Apple ID with no event calendars is a sync that found nothing, not a silent success
      const last_error = r.calendars ? null : NO_CALENDARS
      await p.updateAccount(acc.id, { last_sync_at: new Date().toISOString(), last_error })
      results.push({ id: acc.id, ...r, ...(last_error ? { error: last_error } : {}) })
    } catch (e) {
      const msg = e instanceof CalDavAuthError ? 'iCloud rejected the app-specific password — reconnect in Settings.' : `Sync failed: ${(e as Error).message}`
      await p.updateAccount(acc.id, { last_error: msg })
      results.push({ id: acc.id, error: msg })
    }
  }
  return json(200, { accounts: results })
}
