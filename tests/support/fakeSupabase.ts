// Hermetic stand-in for the press Supabase project: PostgREST upsert/select for planner_*, the
// planner_merge() trigger (same mergeRow as the client), planner_sync_log, and realtime postgres_changes
// over the Phoenix v2 socket. One instance is shared by every browser context in a test, so two
// "devices" converge through it exactly as through the real server. Fail-closed: any other request to a
// supabase.co host is aborted and recorded.

import type { BrowserContext, Page, Route, WebSocketRoute } from '@playwright/test'
import { mergeRow } from '../../src/sync/merge'

export const SUPABASE_HOST = 'eepjhpyziczrxvirczio.supabase.co'
export const TEST_USER = { id: '00000000-0000-4000-8000-00000000cafe', email: 'test@optimo.invalid' }

type Row = Record<string, unknown> & { field_ts?: Record<string, number> }
const TABLES = ['planner_categories', 'planner_tasks', 'planner_exceptions', 'planner_settings'] as const

const DEFAULTS: Record<string, Row> = {
  planner_categories: { color: 'work', icon: 'dot', sort_key: 0 },
  planner_tasks: {
    title: '', notes: '', category_id: null, priority: 0, start_at: null, duration_min: 30, all_day: false,
    completed_at: null, subtasks: [], reminders: [], sort_key: 0, rrule: null, dtstart: null, series_id: null,
  },
  planner_exceptions: { task_id: null, skipped: false },
  planner_settings: { data: {} },
}

function keyOf(table: string, r: Row): string {
  if (table === 'planner_exceptions') return `${r.series_id}|${r.occurrence_date}`
  if (table === 'planner_settings') return String(r.user_id)
  return String(r.id)
}

function b64url(o: object) {
  return Buffer.from(JSON.stringify(o)).toString('base64url')
}

export function fakeSession() {
  const exp = Math.floor(Date.now() / 1000) + 24 * 3600
  const jwt = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: TEST_USER.id, role: 'authenticated', exp, email: TEST_USER.email })}.sig`
  return {
    access_token: jwt,
    token_type: 'bearer',
    expires_in: 24 * 3600,
    expires_at: exp,
    refresh_token: 'fake-refresh',
    user: { id: TEST_USER.id, aud: 'authenticated', role: 'authenticated', email: TEST_USER.email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  }
}

export class FakeSupabase {
  rows: Record<string, Map<string, Row>> = Object.fromEntries(TABLES.map((t) => [t, new Map()]))
  log: { seq: number; user_id: string; table_name: string; row_id: string; op: string; at: string }[] = []
  unexpected: string[] = []
  requests = 0
  /** The code the fake "emails"; /verify accepts only this. */
  otpCode = '424242'
  otpSends: string[] = []
  lastOtpAt = 0
  private sockets = new Set<{ ws: WebSocketRoute; topic: string; id: number }>()
  private nextBindingId = 1000

  /** Route a context (all its pages) through the fake and seed a signed-in session. */
  async attach(context: BrowserContext, opts: { signedIn?: boolean; pollMs?: number } = {}) {
    const session = fakeSession()
    await context.addInitScript(
      ([s, host, signedIn, pollMs]) => {
        localStorage.setItem('optimo.test', '1')
        if (pollMs) localStorage.setItem('optimo.pollMs', String(pollMs))
        if (signedIn && !localStorage.getItem(`sb-${host.split('.')[0]}-auth-token`))
          localStorage.setItem(`sb-${host.split('.')[0]}-auth-token`, JSON.stringify(s))
      },
      [session, SUPABASE_HOST, opts.signedIn ?? true, opts.pollMs ?? 0] as const,
    )
    await context.route(/https:\/\/[^/]*supabase\.co\//, (route) => this.handle(route))
    await context.routeWebSocket(/wss:\/\/[^/]*supabase\.co\//, (ws) => this.socket(ws))
  }

  // ---------- HTTP ----------
  private async handle(route: Route) {
    this.requests++
    const req = route.request()
    const url = new URL(req.url())
    const method = req.method()
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'access-control-expose-headers': 'content-range',
    }
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) })
    if (url.host !== SUPABASE_HOST) {
      this.unexpected.push(`${method} ${url.href}`)
      return route.abort()
    }
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })

    const p = url.pathname
    if (p.startsWith('/auth/v1/')) {
      if (p === '/auth/v1/user') return json(200, fakeSession().user)
      if (p === '/auth/v1/otp') {
        // press enforces a 60 s per-address resend window; mirror its 429 + message
        const wait = 60 - Math.floor((Date.now() - this.lastOtpAt) / 1000)
        if (this.lastOtpAt && wait > 0)
          return json(429, { code: 429, error_code: 'over_email_send_rate_limit', msg: `For security purposes, you can only request this after ${wait} seconds.` })
        this.lastOtpAt = Date.now()
        this.otpSends.push(JSON.parse(req.postData() ?? '{}').email)
        return json(200, {})
      }
      if (p === '/auth/v1/verify') {
        const body = JSON.parse(req.postData() ?? '{}')
        if (body.type === 'email' && body.token === this.otpCode) return json(200, fakeSession())
        return json(403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' })
      }
      if (p === '/auth/v1/logout') return route.fulfill({ status: 204, headers: cors })
      if (p === '/auth/v1/token') return json(200, fakeSession())
    }
    const m = p.match(/^\/rest\/v1\/(planner_\w+)$/)
    if (m) {
      const table = m[1]
      if (method === 'POST' && (TABLES as readonly string[]).includes(table)) {
        const body = JSON.parse(req.postData() ?? '[]')
        for (const r of Array.isArray(body) ? body : [body]) this.upsert(table, r)
        return route.fulfill({ status: 201, headers: cors })
      }
      if (method === 'GET') return json(200, this.select(table, url.searchParams))
    }
    this.unexpected.push(`${method} ${url.pathname}${url.search}`)
    return json(404, { message: 'not in fake' })
  }

  upsert(table: string, incoming: Row) {
    const r: Row = { ...incoming, user_id: TEST_USER.id }
    const k = keyOf(table, r)
    const stored = this.rows[table].get(k)
    let row: Row
    let op: 'insert' | 'update'
    if (!stored) {
      row = { ...DEFAULTS[table], ...r, version: 1, updated_at: new Date().toISOString(), deleted_at: r.deleted_at ?? null, field_ts: r.field_ts ?? {} }
      op = 'insert'
    } else {
      // ON CONFLICT DO UPDATE: NEW = stored overlaid with the sent columns, then planner_merge()
      row = mergeRow(stored, { ...stored, ...r })
      row.version = Number(stored.version) + 1
      row.updated_at = new Date().toISOString()
      op = 'update'
    }
    this.rows[table].set(k, row)
    const entry = { seq: this.log.length + 1, user_id: TEST_USER.id, table_name: table, row_id: k, op, at: new Date().toISOString() }
    this.log.push(entry)
    this.broadcast(entry)
  }

  private select(table: string, q: URLSearchParams): Row[] {
    let rows: Row[] = table === 'planner_sync_log' ? [...this.log] : [...(this.rows[table]?.values() ?? [])]
    for (const [col, expr] of q.entries()) {
      if (['select', 'order', 'limit', 'offset'].includes(col)) continue
      const [op, ...rest] = expr.split('.')
      const val = rest.join('.')
      if (op === 'gt') rows = rows.filter((r) => Number(r[col]) > Number(val))
      else if (op === 'eq') rows = rows.filter((r) => String(r[col]) === val)
      else if (op === 'in') {
        const set = new Set(val.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, '')))
        rows = rows.filter((r) => set.has(String(r[col])))
      }
    }
    const order = q.get('order')
    if (order) {
      const [col, dir] = order.split('.')
      rows.sort((a, b) => (Number(a[col]) - Number(b[col])) * (dir === 'desc' ? -1 : 1))
    }
    const limit = Number(q.get('limit') ?? 0)
    return limit ? rows.slice(0, limit) : rows
  }

  // ---------- realtime (Phoenix vsn 2.0.0: [join_ref, ref, topic, event, payload]) ----------
  private socket(ws: WebSocketRoute) {
    ws.onMessage((raw) => {
      if (typeof raw !== 'string') return
      const [joinRef, ref, topic, event, payload] = JSON.parse(raw)
      const reply = (response: object) => ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response }]))
      if (event === 'phx_join') {
        const pcs = (payload?.config?.postgres_changes ?? []).map((f: object) => ({ ...f, id: this.nextBindingId++ }))
        for (const f of pcs) this.sockets.add({ ws, topic, id: f.id })
        reply({ postgres_changes: pcs })
        ws.send(JSON.stringify([joinRef, null, topic, 'system', { status: 'ok', message: 'Subscribed to PostgreSQL', extension: 'postgres_changes', channel: topic }]))
      } else if (event === 'phx_leave') {
        for (const s of [...this.sockets]) if (s.ws === ws && s.topic === topic) this.sockets.delete(s)
        reply({})
      } else {
        reply({}) // heartbeat, access_token, …
      }
    })
    ws.onClose(() => {
      for (const s of [...this.sockets]) if (s.ws === ws) this.sockets.delete(s)
    })
  }

  private broadcast(entry: Row) {
    for (const s of this.sockets) {
      try {
        s.ws.send(
          JSON.stringify([
            null,
            null,
            s.topic,
            'postgres_changes',
            { ids: [s.id], data: { schema: 'public', table: 'planner_sync_log', type: 'INSERT', commit_timestamp: entry.at, record: entry, columns: [], errors: null } },
          ]),
        )
      } catch {
        this.sockets.delete(s)
      }
    }
  }

  task(id: string): Row | undefined {
    return this.rows.planner_tasks.get(id)
  }
}

/** Convenience: collect console errors on a page (ignoring network failures we cause on purpose offline). */
export function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (/ERR_INTERNET_DISCONNECTED|Failed to fetch|NetworkError|net::ERR/.test(t)) return
    errors.push(t)
  })
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}
