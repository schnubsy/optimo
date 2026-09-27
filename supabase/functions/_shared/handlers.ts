// calendar-connect / calendar-sync as plain Request → Response handlers over ports, so the Deno entry points
// (…/index.ts, service-role supabase-js) and the hermetic test fake (tests/support/fakeSupabase.ts) run the same code.
import { CalDav, CalDavAuthError, type DavCalendar, type Fetch } from './caldav.ts'
import { decryptSecret, encryptSecret, importKek } from './crypto.ts'
import { parseIcs } from './ics.ts'

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
export interface Ports {
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
  let calendars: DavCalendar[]
  let principal: string
  try {
    principal = await dav.principal()
    calendars = await dav.calendars(await dav.homeSet(principal))
  } catch (e) {
    // never log the password — only the failure class
    if (e instanceof CalDavAuthError) return json(401, { error: 'iCloud didn’t accept that Apple ID and app-specific password.' })
    p.log?.(`calendar-connect: discovery failed (${(e as Error).message})`)
    return json(502, { error: 'Couldn’t reach iCloud Calendar — try again in a moment.' })
  }
  const row: AccountRow = {
    id: p.newId(),
    user_id: userId,
    provider: 'icloud',
    label: (body.label ?? '').trim() || 'iCloud',
    username,
    secret_enc: await encryptSecret(password, await importKek(p.kek)),
    principal_url: principal,
    calendars,
    enabled: true,
    last_sync_at: null,
    last_error: null,
  }
  await p.insertAccount(row)
  return json(200, publicRow(row))
}

/** Sync one account: REPORT each enabled calendar over [now−7d, now+60d], upsert changed instances, tombstone the rest. */
export async function syncAccount(acc: AccountRow, p: Ports, now = new Date()): Promise<{ upserted: number; removed: number }> {
  const from = new Date(now.getTime() - WINDOW_BACK_DAYS * 86_400_000)
  const to = new Date(now.getTime() + WINDOW_AHEAD_DAYS * 86_400_000)
  const password = await decryptSecret(acc.secret_enc, await importKek(p.kek))
  const dav = new CalDav(acc.principal_url ?? ICLOUD, CalDav.basic(acc.username, password), p.fetch)
  const existing = await p.eventKeys(acc.id)
  const seen = new Set<string>()
  const changed: EventRow[] = []
  for (const cal of acc.calendars) {
    if (!cal.enabled) continue
    for (const obj of await dav.events(cal.href, from, to)) {
      for (const inst of parseIcs(obj.ics, from, to)) {
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
  return { upserted: changed.length, removed: gone.length }
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
  const results: { id: string; upserted?: number; removed?: number; error?: string }[] = []
  for (const acc of (await p.accounts(userId)).filter((a) => a.enabled)) {
    try {
      const r = await syncAccount(acc, p)
      await p.updateAccount(acc.id, { last_sync_at: new Date().toISOString(), last_error: null })
      results.push({ id: acc.id, ...r })
    } catch (e) {
      const msg = e instanceof CalDavAuthError ? 'iCloud rejected the app-specific password — reconnect in Settings.' : `Sync failed: ${(e as Error).message}`
      await p.updateAccount(acc.id, { last_error: msg })
      results.push({ id: acc.id, error: msg })
    }
  }
  return json(200, { accounts: results })
}
