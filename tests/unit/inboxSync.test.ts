// arc 7 slice 7 — plan_date / someday / estimated through the sync engine: push and pull carry them; a server without
// db/008 never fails a push permanently (rows go up without the columns and are re-sent in full once they exist).
import { beforeEach, describe, expect, it } from 'vitest'
import { OptimoDB, useDatabase, db, getMeta } from '../../src/data/db'
import * as repo from '../../src/data/repo'
import { COLUMN_BACKLOG, SyncEngine, applyRemote, isMissingColumn, withoutColumns } from '../../src/sync/engine'
import { mergeRow } from '../../src/sync/merge'

type Row = Record<string, unknown> & { field_ts?: Record<string, number> }
const COLS = ['plan_date', 'someday', 'estimated']
const USER = 'u1'

/** A PostgREST-shaped stand-in: planner_merge() upserts (the client's mergeRow), planner_sync_log, the 008 columns. */
class MiniServer {
  rows = new Map<string, Row>()
  log: { seq: number; table_name: string; row_id: string }[] = []
  inboxCols = true
  calls: string[] = []
  upsert(r: Row) {
    const defaults: Row = this.inboxCols ? { plan_date: null, someday: false, estimated: true } : {}
    const prior = this.rows.get(String(r.id))
    const stored: Row | undefined = prior && { ...defaults, ...prior } // `add column … default` gives existing rows the column too
    const row: Row = stored ? mergeRow(stored, { ...stored, ...r }) : { ...defaults, ...r, version: 1, field_ts: r.field_ts ?? {} }
    if (stored) row.version = Number(stored.version) + 1
    this.rows.set(String(r.id), { ...row, user_id: USER })
    this.log.push({ seq: this.log.length + 1, table_name: 'planner_tasks', row_id: String(r.id) })
  }
  client() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- the builder closes over the server
    const srv = this
    return {
      from(table: string) {
        const q: { select?: string; gt?: number; in?: string[]; limit?: number } = {}
        const run = async () => {
          srv.calls.push(`GET ${table} ${q.select}`)
          if (table === 'planner_sync_log') return { data: srv.log.filter((l) => l.seq > (q.gt ?? 0)).slice(0, q.limit ?? 1000), error: null }
          if (table !== 'planner_tasks') return { data: [], error: null }
          const missing = !srv.inboxCols && COLS.find((c) => (q.select ?? '').split(',').includes(c))
          if (missing) return { data: null, error: { code: '42703', message: `column planner_tasks.${missing} does not exist` } }
          return { data: [...srv.rows.values()].filter((r) => !q.in || q.in.includes(String(r.id))).map((r) => ({ ...r })), error: null }
        }
        const builder = {
          select(s: string) { q.select = s; return builder },
          gt(_c: string, v: number) { q.gt = v; return builder },
          order() { return builder },
          limit(n: number) { q.limit = n; return builder },
          in(_c: string, ids: string[]) { q.in = ids; return builder },
          then(res: (v: unknown) => unknown, rej: (e: unknown) => unknown) { return run().then(res, rej) },
          async upsert(rows: Row[]) {
            srv.calls.push(`POST ${table}`)
            if (table === 'planner_tasks' && !srv.inboxCols) {
              const bad = COLS.find((c) => rows.some((r) => c in r))
              if (bad) return { error: { code: 'PGRST204', message: `Could not find the '${bad}' column of 'planner_tasks' in the schema cache` } }
            }
            if (table === 'planner_tasks') for (const r of rows) srv.upsert(r)
            return { error: null }
          },
        }
        return builder
      },
    }
  }
}

let server: MiniServer
beforeEach(async () => {
  useDatabase(new OptimoDB(`is-${Math.random()}`))
  await db.open()
  server = new MiniServer()
})
const engine = () => new SyncEngine(server.client() as never, USER)

describe('sync — inbox-first fields', () => {
  it('push carries plan_date / someday / estimated with their field_ts; a second device pulls the derived kinds', async () => {
    const p = await repo.captureToInbox('Planned', { plan_date: '2026-10-12' })
    const s = await repo.captureToInbox('Parked', { someday: true })
    await engine().push()
    expect(await db.outbox.count()).toBe(0)
    expect(server.rows.get(p.id)).toMatchObject({ plan_date: '2026-10-12', someday: false, estimated: false })
    expect(server.rows.get(p.id)!.field_ts!.plan_date).toBe(p.field_ts.plan_date)
    expect(server.rows.get(s.id)).toMatchObject({ someday: true, plan_date: null })

    useDatabase(new OptimoDB(`is-b-${Math.random()}`)) // device B
    await db.open()
    await engine().pull()
    expect(await db.tasks.get(p.id)).toMatchObject({ _kind: 'planned', plan_date: '2026-10-12', estimated: false })
    expect(await db.tasks.get(s.id)).toMatchObject({ _kind: 'someday', someday: true })
    // B schedules it; A's later pull sees the place move as a unit
    await repo.updateTask(p.id, { start_at: '2026-10-12T09:00:00.000Z' })
    await engine().push()
    expect(server.rows.get(p.id)).toMatchObject({ plan_date: null, someday: false, start_at: '2026-10-12T09:00:00.000Z' })
  })

  it('pull: a planned row on the server lands planned; a later server move to Someday wins field-level', async () => {
    const t = await repo.captureToInbox('Local')
    await repo.planForDay(t.id, '2026-10-12')
    const local = (await db.tasks.get(t.id))!
    const later = local.field_ts.plan_date + 1000
    await applyRemote('tasks', [{ ...local, _kind: undefined, someday: true, plan_date: null, field_ts: { ...local.field_ts, someday: later, plan_date: later, start_at: later }, user_id: USER }])
    expect(await db.tasks.get(t.id)).toMatchObject({ _kind: 'someday', someday: true, plan_date: null })
  })

  it('pull from a pre-008 server: missing columns keep local values, new rows get the defaults', async () => {
    const t = await repo.captureToInbox('Planned here', { plan_date: '2026-10-12' })
    const { plan_date: _p, someday: _s, estimated: _e, _kind: _k, ...serverShape } = (await db.tasks.get(t.id))!
    await applyRemote('tasks', [{ ...serverShape, title: 'Renamed elsewhere', field_ts: { ...serverShape.field_ts, title: Date.now() + 5000 } }])
    expect(await db.tasks.get(t.id)).toMatchObject({ title: 'Renamed elsewhere', _kind: 'planned', plan_date: '2026-10-12', estimated: false })
    await applyRemote('tasks', [{ id: '0199a000-0000-7000-8000-0000000000f1', title: 'From an old client', start_at: null, rrule: null, series_id: null, deleted_at: null, field_ts: { title: 1 } }])
    expect(await db.tasks.get('0199a000-0000-7000-8000-0000000000f1')).toMatchObject({ _kind: 'inbox', plan_date: null, someday: false, estimated: true })
  })

  it('server without db/008: the push degrades (no error, nothing pending), then re-sends the rows in full once 008 lands', async () => {
    server.inboxCols = false
    const p = await repo.captureToInbox('Planned early', { plan_date: '2026-10-12' })
    const e = engine()
    await expect(e.push()).resolves.toBeUndefined()
    expect(await db.outbox.count()).toBe(0)
    expect(e.missingCols.has('tasks')).toBe(true)
    expect(server.rows.get(p.id)).toMatchObject({ title: 'Planned early' })
    expect(server.rows.get(p.id)).not.toHaveProperty('plan_date')
    expect(Object.keys(server.rows.get(p.id)!.field_ts!)).not.toContain('plan_date') // no ts claimed for a value not sent
    expect(await getMeta(COLUMN_BACKLOG, {})).toEqual({ tasks: [p.id] })

    // the next write goes straight up without the columns: no doomed request first, one probe per push
    server.calls = []
    await repo.updateTask(p.id, { title: 'Planned early v2' })
    await e.push()
    expect(server.calls).toEqual(['GET planner_tasks plan_date,someday,estimated', 'POST planner_tasks'])
    expect(server.rows.get(p.id)).toMatchObject({ title: 'Planned early v2' })

    // 008 applied: the probe passes, the backlog is re-queued from the local rows and pushed in full
    server.inboxCols = true
    await e.push()
    expect(e.missingCols.has('tasks')).toBe(false)
    expect(server.rows.get(p.id)).toMatchObject({ title: 'Planned early v2', plan_date: '2026-10-12', estimated: false })
    expect(server.rows.get(p.id)!.field_ts!.plan_date).toBe(p.field_ts.plan_date)
    expect(await getMeta(COLUMN_BACKLOG, {})).toEqual({})
    expect(await db.outbox.count()).toBe(0)
    server.calls = []
    await e.push()
    expect(server.calls).toEqual([]) // nothing left to probe or send
  })

  it('isMissingColumn / withoutColumns', () => {
    expect(isMissingColumn({ code: 'PGRST204', message: "Could not find the 'plan_date' column of 'planner_tasks' in the schema cache" })).toBe(true)
    expect(isMissingColumn({ code: '42703', message: 'column planner_tasks.someday does not exist' })).toBe(true)
    expect(isMissingColumn({ code: 'PGRST205', message: "Could not find the table 'public.x'" })).toBe(false)
    expect(isMissingColumn({ code: '23514', message: 'violates check constraint' })).toBe(false)
    expect(isMissingColumn(null)).toBe(false)
    expect(withoutColumns({ id: 'a', title: 't', plan_date: 'x', field_ts: { title: 1, plan_date: 2 } }, COLS)).toEqual({ id: 'a', title: 't', field_ts: { title: 1 } })
  })
})
