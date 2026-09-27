// In-memory Ports for the calendar handlers (unit tests + deno test). The Playwright fake implements the same
// interface over its PostgREST tables (tests/support/fakeSupabase.ts).
import type { AccountRow, EventRow, Ports } from '../../supabase/functions/_shared/handlers.ts'
import { eventKey } from '../../supabase/functions/_shared/handlers.ts'
import type { Fetch } from '../../supabase/functions/_shared/caldav.ts'

export const TEST_KEK = btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i + 1)))
export const TEST_CRON = 'cron-secret-for-tests'

export class MemPorts implements Ports {
  kek = TEST_KEK
  cronSecret = TEST_CRON
  accountsById = new Map<string, AccountRow>()
  events = new Map<string, EventRow & { id: string }>()
  logs: string[] = []
  private n = 0
  fetch: Fetch
  private users: Record<string, string>
  constructor(fetch: Fetch, users: Record<string, string> = { 'jwt-mark': 'user-mark' }) {
    this.fetch = fetch
    this.users = users
  }
  newId = () => `00000000-0000-4000-8000-${String(++this.n).padStart(12, '0')}`
  log = (m: string) => void this.logs.push(m)
  userFromJwt = async (jwt: string) => this.users[jwt] ?? null
  insertAccount = async (row: AccountRow) => void this.accountsById.set(row.id, structuredClone(row))
  accounts = async (userId: string | null) => [...this.accountsById.values()].filter((a) => !userId || a.user_id === userId)
  updateAccount = async (id: string, patch: Partial<AccountRow>) => void Object.assign(this.accountsById.get(id)!, patch)
  eventKeys = async (accountId: string) =>
    new Map([...this.events.values()].filter((e) => e.account_id === accountId && !e.deleted_at).map((e) => [eventKey(e.calendar_href, e.uid), `${e.etag}|${e.start_at}|${e.end_at}|${e.title}`]))
  upsertEvents = async (rows: EventRow[]) => {
    for (const r of rows) {
      const k = `${r.account_id}\u0000${eventKey(r.calendar_href, r.uid)}`
      this.events.set(k, { ...r, id: this.events.get(k)?.id ?? this.newId() })
    }
  }
  tombstoneEvents = async (accountId: string, keys: string[]) => {
    for (const k of keys) this.events.get(`${accountId}\u0000${k}`)!.deleted_at = new Date().toISOString()
  }
  live = () => [...this.events.values()].filter((e) => !e.deleted_at)
}
