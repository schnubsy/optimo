// In-memory Ports for the calendar handlers (unit tests + deno test). The Playwright fake implements the same
// interface over its PostgREST tables (tests/support/fakeSupabase.ts).
import type { AccountRow, EventRow, Ports } from '../../supabase/functions/_shared/handlers.ts'
import { eventKey } from '../../supabase/functions/_shared/handlers.ts'
import type { Fetch } from '../../supabase/functions/_shared/caldav.ts'
import type { LinkRow, TaskRow } from '../../supabase/functions/_shared/twoway.ts'

export type MemTask = TaskRow & { field_ts: Record<string, number>; device_id?: string | null }

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

  // ---- two-way (arc 4): planner_tasks with version + field_ts (LWW per field, like planner_merge), links ----
  tasks = new Map<string, MemTask>()
  calLinks = new Map<string, LinkRow>()
  tz = 'UTC'
  /** a client's write (the outbox upsert): bumps version, stamps field_ts — same rules as the server merge */
  clientWrite(id: string, fields: Partial<TaskRow>, ts = Date.now()) {
    const cur = this.tasks.get(id)
    if (!cur) {
      const row: MemTask = { id, user_id: 'user-mark', title: '', start_at: null, duration_min: 30, all_day: false, rrule: null, series_id: null, deleted_at: null, version: 1, field_ts: {}, ...fields }
      for (const k of Object.keys(fields)) row.field_ts[k] = ts
      this.tasks.set(id, row)
      return row
    }
    return this.merge(cur, fields as Record<string, unknown>, ts)
  }
  private merge(cur: MemTask, fields: Record<string, unknown>, ts: number) {
    for (const [k, v] of Object.entries(fields)) {
      if ((cur.field_ts[k] ?? 0) > ts) continue
      ;(cur as unknown as Record<string, unknown>)[k] = v
      cur.field_ts[k] = ts
    }
    cur.version++
    return cur
  }
  tasksForPush = async (userId: string, fromIso: string) =>
    [...this.tasks.values()].filter((t) => t.user_id === userId && t.start_at && t.start_at >= fromIso && !t.rrule && !t.series_id && !t.deleted_at).map((t) => ({ ...t }))
  tasksByIds = async (userId: string, ids: string[]) => ids.map((id) => this.tasks.get(id)).filter((t): t is MemTask => !!t && t.user_id === userId).map((t) => ({ ...t }))
  links = async (accountId: string) => [...this.calLinks.values()].filter((l) => l.account_id === accountId).map((l) => ({ ...l }))
  upsertLink = async (row: LinkRow) => void this.calLinks.set(row.task_id, { ...row })
  deleteLink = async (taskId: string) => void this.calLinks.delete(taskId)
  serverWrites: { id: string; fields: Record<string, unknown> }[] = []
  writeTask = async (_userId: string, id: string, fields: Record<string, unknown>, ts: number) => {
    this.serverWrites.push({ id, fields })
    return this.merge(this.tasks.get(id)!, { ...fields, device_id: 'calendar-sync' }, ts).version
  }
  userTz = async () => this.tz
}
