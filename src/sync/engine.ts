// Sync engine — implements docs/spec.md §5.2 exactly: outbox push (upsert, server merges field-level LWW),
// cursor pull over planner_sync_log, realtime-triggered pulls, 60 s poll fallback, `online` ⇒ push + pull.

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { db, getMeta, setMeta } from '../data/db'
import { onLocalWrite, taskKind } from '../data/repo'
import { REMOTE_TABLE, type Category, type Exception, type Settings, type TableName, type Task } from '../data/types'
import { mergeRow } from './merge'
import { useSync } from '../state/sync'

const PUSH_ORDER: TableName[] = ['categories', 'tasks', 'exceptions', 'settings']
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
}

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

  constructor(sb: SupabaseClient, userId: string) {
    this.sb = sb
    this.userId = userId
  }

  async start() {
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

  private async refreshPending() {
    const n = await db.outbox.count()
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
      const n = await db.outbox.count()
      set({ state: n > 0 ? 'pending' : 'synced', pending: n, lastSync: Date.now(), error: null })
    } catch (e) {
      const offline = !navigator.onLine
      set({ state: offline ? 'offline' : 'error', error: offline ? null : String((e as Error).message ?? e) })
      // back off 1 s → 60 s, then retry
      this.backoff = Math.min(60_000, this.backoff ? this.backoff * 2 : 1000)
      if (!this.stopped) this.timers.push(setTimeout(() => void this.run(), this.backoff))
    }
  }

  async push() {
    const entries = await db.outbox.orderBy('seq').toArray()
    if (!entries.length) return
    const maxSeq = entries[entries.length - 1].seq!
    for (const table of PUSH_ORDER) {
      // Latest outbox payload per row wins (the local row already carries every field's ts).
      const latest = new Map<string, Record<string, unknown>>()
      for (const e of entries) if (e.table === table) latest.set(e.id, e.payload)
      if (!latest.size) continue
      const rows = [...latest.values()].map((p) => toRemote(table, p))
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { error } = await this.sb
          .from(REMOTE_TABLE[table])
          .upsert(rows.slice(i, i + CHUNK), { onConflict: CONFLICT[table], ignoreDuplicates: false, defaultToNull: false })
        if (error) throw new Error(`push ${table}: ${error.message}`)
      }
    }
    await db.outbox.where('seq').belowOrEqual(maxSeq).delete()
    this.refreshPending()
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
      for (const l of log) {
        const t = TABLE_OF[l.table_name as string]
        if (!t) continue
        if (!byTable.has(t)) byTable.set(t, new Set())
        byTable.get(t)!.add(String(l.row_id))
      }
      for (const table of PUSH_ORDER) {
        const ids = byTable.get(table)
        if (ids?.size) await this.fetchAndMerge(table, [...ids])
      }
      cursor = Number(log[log.length - 1].seq)
      await setMeta('cursor', cursor)
      if (log.length < PAGE) return
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

/** Merge fetched server rows into the local store with the same field-level LWW as the server. */
export async function applyRemote(table: TableName, rows: Record<string, unknown>[]) {
  const tbl = db.table(table)
  await db.transaction('rw', tbl, async () => {
    for (const raw of rows) {
      const incoming = fromRemote(table, raw)
      const key = table === 'exceptions' ? [incoming.series_id, incoming.occurrence_date] : incoming.id
      const local = await tbl.get(key as never)
      const merged = local ? mergeRow(local, incoming) : incoming
      if (table === 'tasks') (merged as Task)._kind = taskKind(merged as Task)
      await tbl.put(merged as Task | Category | Exception | Settings)
    }
  })
}
