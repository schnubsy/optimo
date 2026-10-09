// Sync engine — implements docs/spec.md §5.2 exactly: outbox push (upsert, server merges field-level LWW),
// cursor pull over planner_sync_log, realtime-triggered pulls, 60 s poll fallback, `online` ⇒ push + pull.

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { db, getMeta, setMeta } from '../data/db'
import { onLocalWrite, taskKind, toPayload } from '../data/repo'
import { withTaskDefaults } from '../data/place'
import { OPTIONAL_COLUMNS, OPTIONAL_TABLES, REMOTE_TABLE, type AiPlan, type AiProfile, type CalendarEvent, type Category, type Exception, type Settings, type TableName, type Task } from '../data/types'
import { mergeRow } from './merge'
import { useSync } from '../state/sync'

const PUSH_ORDER: TableName[] = ['categories', 'tasks', 'exceptions', 'settings', 'aiPlans', 'aiProfile']
const TABLE_OF: Record<string, TableName> = Object.fromEntries(
  Object.entries(REMOTE_TABLE).map(([k, v]) => [v, k as TableName]),
)
const CHUNK = 100
const PAGE = 1000

function pollMs(): number {
  try {
    const v = Number(localStorage.getItem('optimo.pollMs'))
    if (v > 0) return v
  } catch {
    /* default */
  }
  return 60_000
}

const iso = (v: unknown) => (typeof v === 'string' ? new Date(v).toISOString() : (v as null))

/** Normalise a PostgREST row into the local shape (ISO timestamps, local keys). */
export function fromRemote(table: TableName, r: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = { ...r }
  for (const k of ['start_at', 'completed_at', 'dtstart', 'deleted_at', 'updated_at']) if (k in row) row[k] = iso(row[k])
  if ('version' in row) row.version = Number(row.version)
  delete row.user_id
  if (table === 'settings') row.id = 'me'
  return row
}

/** Shape a local row for PostgREST: drop server-owned and local-only columns. */
export function toRemote(table: TableName, payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(payload)) {
    if (k.startsWith('_') || k === 'version' || k === 'updated_at' || k === 'user_id') continue
    out[k] = v
  }
  if (table === 'settings') delete out.id
  return out
}

const CONFLICT: Record<TableName, string> = {
  categories: 'id',
  tasks: 'id',
  exceptions: 'series_id,occurrence_date',
  settings: 'user_id',
  aiPlans: 'id',
  aiProfile: 'id',
}

/** PostgREST's answer when a table isn't in the schema (yet): PGRST205 / 404, or Postgres 42P01. */
export function isMissingTable(error: { code?: string; message?: string; status?: number } | null): boolean {
  if (!error) return false
  return error.code === 'PGRST205' || error.code === '42P01' || /could not find the table|does not exist/i.test(error.message ?? '')
}

/** PostgREST's answer when a column isn't in the schema (yet): PGRST204 on write, 42703 on read. */
export function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === 'PGRST204' || error.code === '42703' || /could not find the '[^']+' column|column \S+ does not exist/i.test(error.message ?? '')
}

/** A row (and its field_ts) without the given columns — what a server lacking them can take. */
export function withoutColumns(row: Record<string, unknown>, cols: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row }
  for (const c of cols) delete out[c]
  if (out.field_ts && typeof out.field_ts === 'object') {
    const ts = { ...(out.field_ts as Record<string, number>) }
    for (const c of cols) delete ts[c]
    out.field_ts = ts
  }
  return out
}

/** meta key: per table, the ids pushed without their optional columns — re-sent in full once the server has them. */
export const COLUMN_BACKLOG = 'colBacklog'
type Backlog = Partial<Record<TableName, string[]>>

/** Listeners told which tables an outbox push just sent (arc 4: task pushes trigger the iCloud write-back). */
export const afterPush = new Set<(tables: Set<TableName>) => void>()

/** The running engine (one per signed-in session) — calendar sync asks it to pull after the server refresh. */
export let activeEngine: SyncEngine | null = null

export class SyncEngine {
  private sb: SupabaseClient
  private userId: string
  private channel: RealtimeChannel | null = null
  private timers: ReturnType<typeof setTimeout>[] = []
  private pushTimer: ReturnType<typeof setTimeout> | null = null
  private pullTimer: ReturnType<typeof setTimeout> | null = null
  private backoff = 0
  private busy: Promise<void> | null = null
  private again = false
  private stopped = false
  private unsub: (() => void) | null = null
  /** Optional tables (db/004_ai.sql) the server doesn't have yet: their outbox rows wait, retried every cycle. */
  readonly parked = new Set<TableName>()
  /** Tables whose OPTIONAL_COLUMNS the server lacks (db/008 not applied yet): pushed without them, backlogged. */
  readonly missingCols = new Set<TableName>()

  constructor(sb: SupabaseClient, userId: string) {
    this.sb = sb
    this.userId = userId
  }

  async start() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- the module-level handle IS the point
    activeEngine = this
    // A different account on this device starts from a clean cursor.
    const owner = await getMeta<string | null>('owner', null)
    if (owner && owner !== this.userId) await setMeta('cursor', 0)
    await setMeta('owner', this.userId)

    this.unsub = onLocalWrite(() => this.schedulePush())
    window.addEventListener('online', this.onOnline)
    window.addEventListener('offline', this.onOffline)
    this.channel = this.sb
      .channel(`planner-sync-${this.userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'planner_sync_log', filter: `user_id=eq.${this.userId}` },
        () => this.schedulePull(250),
      )
      .subscribe()
    const tick = () => {
      if (this.stopped) return
      void this.run()
      this.timers.push(setTimeout(tick, pollMs()))
    }
    this.refreshPending()
    tick()
  }

  stop() {
    this.stopped = true
    if (activeEngine === this) activeEngine = null
    this.unsub?.()
    window.removeEventListener('online', this.onOnline)
    window.removeEventListener('offline', this.onOffline)
    this.timers.forEach(clearTimeout)
    if (this.pushTimer) clearTimeout(this.pushTimer)
    if (this.pullTimer) clearTimeout(this.pullTimer)
    if (this.channel) void this.sb.removeChannel(this.channel)
  }

  private onOnline = () => {
    this.backoff = 0
    void this.run()
  }
  private onOffline = () => useSync.getState().set({ state: 'offline' })

  private schedulePush(delay = 150) {
    this.refreshPending()
    if (this.pushTimer) clearTimeout(this.pushTimer)
    this.pushTimer = setTimeout(() => void this.run(), delay)
  }

  private schedulePull(delay: number) {
    if (this.pullTimer) clearTimeout(this.pullTimer)
    this.pullTimer = setTimeout(() => void this.run(), delay)
  }

  /** Outbox rows that can actually go up now — rows for parked optional tables don't count as "pending". */
  private async pendingCount(): Promise<number> {
    if (!this.parked.size) return db.outbox.count()
    return db.outbox.filter((e) => !this.parked.has(e.table)).count()
  }

  private async refreshPending() {
    const n = await this.pendingCount()
    const s = useSync.getState()
    s.set({ pending: n, state: !navigator.onLine ? 'offline' : n > 0 ? 'pending' : s.state === 'error' ? 'error' : 'synced' })
  }

  /** Push then pull; serialised, coalescing calls that arrive mid-run. */
  run(): Promise<void> {
    if (this.busy) {
      this.again = true
      return this.busy
    }
    this.busy = (async () => {
      do {
        this.again = false
        await this.cycle()
      } while (this.again && !this.stopped)
    })().finally(() => (this.busy = null))
    return this.busy
  }

  private async cycle() {
    const set = useSync.getState().set
    if (!navigator.onLine) {
      set({ state: 'offline' })
      return
    }
    try {
      await this.push()
      await this.pull()
      this.backoff = 0
      const n = await this.pendingCount()
      // a run that lands after the browser went offline must not paint "synced" over "offline"
      set({ state: !navigator.onLine ? 'offline' : n > 0 ? 'pending' : 'synced', pending: n, lastSync: Date.now(), error: null })
    } catch (e) {
      const offline = !navigator.onLine
      set({ state: offline ? 'offline' : 'error', error: offline ? null : String((e as Error).message ?? e) })
      // back off 1 s → 60 s, then retry
      this.backoff = Math.min(60_000, this.backoff ? this.backoff * 2 : 1000)
      if (!this.stopped) this.timers.push(setTimeout(() => void this.run(), this.backoff))
    }
  }

  /** Rows sent without their optional columns go back into the outbox, in full, once the server has the columns. */
  private async drainColumnBacklog() {
    const backlog = await getMeta<Backlog>(COLUMN_BACKLOG, {})
    let changed = false
    for (const [table, ids] of Object.entries(backlog) as [TableName, string[]][]) {
      const cols = OPTIONAL_COLUMNS[table]
      if (!ids?.length || !cols) continue
      const { error } = await this.sb.from(REMOTE_TABLE[table]).select(cols.join(',')).limit(1)
      if (error) {
        if (isMissingColumn(error)) this.missingCols.add(table)
        continue // still missing (or unreachable): keep the backlog, probe again next cycle
      }
      this.missingCols.delete(table)
      const tbl = db.table(table)
      await db.transaction('rw', tbl, db.outbox, async () => {
        for (const id of ids) {
          const row = (await tbl.get(id)) as Record<string, unknown> | undefined
          if (row) await db.outbox.add({ table, id, op: 'upsert', payload: toPayload(row), field_ts: (row.field_ts ?? {}) as Record<string, number> })
        }
      })
      delete backlog[table]
      changed = true
    }
    if (changed) await setMeta(COLUMN_BACKLOG, backlog)
  }

  async push() {
    await this.drainColumnBacklog()
    const entries = await db.outbox.orderBy('seq').toArray()
    if (!entries.length) return
    const maxSeq = entries[entries.length - 1].seq!
    const held = new Set<TableName>()
    for (const table of PUSH_ORDER) {
      // Latest outbox payload per row wins (the local row already carries every field's ts).
      const latest = new Map<string, Record<string, unknown>>()
      for (const e of entries) if (e.table === table) latest.set(e.id, e.payload)
      if (!latest.size) continue
      const rows = [...latest.values()].map((p) => toRemote(table, p))
      const cols = OPTIONAL_COLUMNS[table]
      const upsert = (chunk: Record<string, unknown>[]) =>
        this.sb.from(REMOTE_TABLE[table]).upsert(chunk, { onConflict: CONFLICT[table], ignoreDuplicates: false, defaultToNull: false })
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK)
        let error = null as Awaited<ReturnType<typeof upsert>>['error']
        if (!cols || !this.missingCols.has(table)) ({ error } = await upsert(chunk))
        if (cols && (this.missingCols.has(table) || isMissingColumn(error))) {
          // the server predates the optional columns (db/008): send the rest now, re-send these rows in full later
          this.missingCols.add(table)
          ;({ error } = await upsert(chunk.map((r) => withoutColumns(r, cols))))
          if (!error) await this.backlog(table, chunk.map((r) => String(r.id)))
        }
        if (error && OPTIONAL_TABLES.has(table) && isMissingTable(error)) {
          // not applied on the server yet: keep these rows queued, never block the core tables (degrade cleanly)
          held.add(table)
          break
        }
        if (error) throw new Error(`push ${table}: ${error.message}`)
      }
    }
    for (const t of OPTIONAL_TABLES) {
      if (held.has(t)) this.parked.add(t)
      else if (!entries.some((e) => e.table === t)) continue
      else this.parked.delete(t)
    }
    await db.outbox
      .where('seq')
      .belowOrEqual(maxSeq)
      .filter((e) => !held.has(e.table))
      .delete()
    this.refreshPending()
    const sent = new Set(entries.map((e) => e.table).filter((t) => !held.has(t)))
    for (const f of afterPush) f(sent)
  }

  private async backlog(table: TableName, ids: string[]) {
    const backlog = await getMeta<Backlog>(COLUMN_BACKLOG, {})
    backlog[table] = [...new Set([...(backlog[table] ?? []), ...ids])]
    await setMeta(COLUMN_BACKLOG, backlog)
  }

  async pull() {
    let cursor = await getMeta<number>('cursor', 0)
    for (;;) {
      const { data: log, error } = await this.sb
        .from('planner_sync_log')
        .select('seq,table_name,row_id')
        .gt('seq', cursor)
        .order('seq', { ascending: true })
        .limit(PAGE)
      if (error) throw new Error(`pull log: ${error.message}`)
      if (!log?.length) return
      const byTable = new Map<TableName, Set<string>>()
      const events = new Set<string>()
      for (const l of log) {
        if (l.table_name === 'planner_events') {
          events.add(String(l.row_id))
          continue
        }
        const t = TABLE_OF[l.table_name as string]
        if (!t) continue
        if (!byTable.has(t)) byTable.set(t, new Set())
        byTable.get(t)!.add(String(l.row_id))
      }
      for (const table of PUSH_ORDER) {
        const ids = byTable.get(table)
        if (ids?.size) await this.fetchAndMerge(table, [...ids])
      }
      if (events.size) await this.fetchEvents([...events])
      cursor = Number(log[log.length - 1].seq)
      await setMeta('cursor', cursor)
      if (log.length < PAGE) return
    }
  }

  /** Calendar events are server-owned: the server row simply replaces the local one (no field-level merge). */
  private async fetchEvents(ids: string[]) {
    for (let i = 0; i < ids.length; i += CHUNK) {
      const { data, error } = await this.sb.from('planner_events').select('*').in('id', ids.slice(i, i + CHUNK))
      if (error) throw new Error(`pull events: ${error.message}`)
      await applyEvents(data ?? [])
    }
  }

  private async fetchAndMerge(table: TableName, ids: string[]) {
    const remote: Record<string, unknown>[] = []
    if (table === 'settings') {
      const { data, error } = await this.sb.from(REMOTE_TABLE.settings).select('*')
      if (error) throw new Error(`pull settings: ${error.message}`)
      remote.push(...(data ?? []))
    } else if (table === 'exceptions') {
      const series = [...new Set(ids.map((k) => k.split('|')[0]))]
      const want = new Set(ids)
      for (let i = 0; i < series.length; i += CHUNK) {
        const { data, error } = await this.sb.from(REMOTE_TABLE.exceptions).select('*').in('series_id', series.slice(i, i + CHUNK))
        if (error) throw new Error(`pull exceptions: ${error.message}`)
        for (const r of data ?? []) if (want.has(`${r.series_id}|${r.occurrence_date}`)) remote.push(r)
      }
    } else {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const { data, error } = await this.sb.from(REMOTE_TABLE[table]).select('*').in('id', ids.slice(i, i + CHUNK))
        if (error) throw new Error(`pull ${table}: ${error.message}`)
        remote.push(...(data ?? []))
      }
    }
    await applyRemote(table, remote)
  }
}

export async function applyEvents(rows: Record<string, unknown>[]) {
  await db.transaction('rw', db.events, async () => {
    for (const r of rows) {
      const e = { ...r, start_at: iso(r.start_at), end_at: iso(r.end_at), deleted_at: iso(r.deleted_at) } as CalendarEvent
      delete (e as { user_id?: string }).user_id
      if (e.deleted_at) await db.events.delete(e.id)
      else await db.events.put(e)
    }
  })
}

/** Merge fetched server rows into the local store with the same field-level LWW as the server. */
export async function applyRemote(table: TableName, rows: Record<string, unknown>[]) {
  const tbl = db.table(table)
  await db.transaction('rw', tbl, async () => {
    for (const raw of rows) {
      const incoming = fromRemote(table, raw)
      const key = table === 'exceptions' ? [incoming.series_id, incoming.occurrence_date] : incoming.id
      const local = await tbl.get(key as never)
      let merged = local ? mergeRow(local, incoming) : incoming
      if (table === 'tasks') {
        merged = withTaskDefaults(merged) // a pre-008 server row lacks plan_date / someday / estimated
        ;(merged as Task)._kind = taskKind(merged as Task)
      }
      await tbl.put(merged as Task | Category | Exception | Settings | AiPlan | AiProfile)
    }
  })
}
