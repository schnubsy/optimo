// Hermetic stand-in for the press Supabase project: PostgREST upsert/select for planner_*, the
// planner_merge() trigger (same mergeRow as the client), planner_sync_log, and realtime postgres_changes
// over the Phoenix v2 socket. One instance is shared by every browser context in a test, so two
// "devices" converge through it exactly as through the real server. Fail-closed: any other request to a
// supabase.co host is aborted and recorded.

import type { BrowserContext, Page, Route, WebSocketRoute } from '@playwright/test'
import { mergeRow } from '../../src/sync/merge'
import { handleConnect, handleSync, eventKey, type AccountRow, type EventRow, type Ports } from '../../supabase/functions/_shared/handlers.ts'
import { fakeCalDav } from '../fake/caldav'
import { handlePlan, PlannerUnavailable, type PlanPorts, type PlanRow, type ProfileRow } from '../../supabase/functions/_shared/plan.ts'
import { FakeModel } from '../fake/planPorts'
import type { LinkRow, TaskRow } from '../../supabase/functions/_shared/twoway.ts'
import { TEST_CRON, TEST_KEK } from '../fake/ports'

export const SUPABASE_HOST = 'eepjhpyziczrxvirczio.supabase.co'
export const TEST_USER = { id: '00000000-0000-4000-8000-00000000cafe', email: 'test@optimo.invalid' }

type Row = Record<string, unknown> & { field_ts?: Record<string, number> }
const TABLES = ['planner_categories', 'planner_tasks', 'planner_exceptions', 'planner_settings'] as const
/** arc 3 (db/004_ai.sql): present only when the test says 004 is applied (`server.ai = true`) */
const AI_TABLES = ['planner_ai_plans', 'planner_ai_profile'] as const
/** server-owned tables written only by the (in-process) Edge Function handlers */
const SERVER_TABLES = ['planner_calendar_accounts', 'planner_events', 'planner_push_subscriptions'] as const

const DEFAULTS: Record<string, Row> = {
  planner_categories: { color: 'work', icon: 'dot', sort_key: 0 },
  planner_tasks: {
    title: '', notes: '', category_id: null, priority: 0, start_at: null, duration_min: 30, all_day: false,
    completed_at: null, subtasks: [], reminders: [], sort_key: 0, rrule: null, dtstart: null, series_id: null,
  },
  planner_exceptions: { task_id: null, skipped: false },
  planner_settings: { data: {} },
  planner_ai_plans: { mode: 'propose', status: 'draft', proposal: {}, research: [], model: null, accepted_task_ids: [] },
  planner_ai_profile: { data: {}, accepted_count: 0 },
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
  rows: Record<string, Map<string, Row>> = Object.fromEntries([...TABLES, ...AI_TABLES, ...SERVER_TABLES].map((t) => [t, new Map()]))
  /** db/004_ai.sql applied? false ⇒ PostgREST answers PGRST205 for planner_ai_* (the pre-Cowork state) */
  ai = false
  /** plan-day deployed? false ⇒ the functions gateway 404s it */
  planFn = false
  /** the scripted Messages API behind plan-day */
  model = new FakeModel()
  planCalls: { action: string; status: number; body: Record<string, unknown> }[] = []
  /** the iCloud side of the calendar functions — a hermetic CalDAV server */
  caldav = fakeCalDav({ requests: [], extra: [], removeDentist: false })
  /** planner_calendar_links (db/005; server-owned, written by the in-process calendar-sync) */
  calLinks = new Map<string, LinkRow>()
  /** function calls with their status (the password gate also greps the stored rows) */
  functionCalls: { name: string; status: number }[] = []
  log: { seq: number; user_id: string; table_name: string; row_id: string; op: string; at: string }[] = []
  unexpected: string[] = []
  requests = 0
  /** The code the fake "emails"; /verify accepts only this. */
  otpCode = '424242'
  otpSends: string[] = []
  lastOtpAt = 0
  /** ms the page's pinned clock (openApp `at`) sits from the wall clock; the in-process handlers use `now()` */
  clockOffset = 0
  now = () => new Date(Date.now() + this.clockOffset)
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
    const fn = p.match(/^\/functions\/v1\/(calendar-connect|calendar-sync)$/)
    if (fn && method === 'POST') {
      const request = new Request(url.href, { method, headers: req.headers(), body: req.postData() ?? '' })
      const res = await (fn[1] === 'calendar-connect' ? handleConnect : handleSync)(request, this.ports())
      this.functionCalls.push({ name: fn[1], status: res.status })
      return route.fulfill({ status: res.status, headers: { ...cors, 'content-type': 'application/json' }, body: await res.text() })
    }
    if (p === '/functions/v1/plan-day' && method === 'POST') {
      if (!this.planFn) return json(404, { code: 'NOT_FOUND', message: 'Requested function was not found' })
      const body = JSON.parse(req.postData() ?? '{}')
      const res = await handlePlan(new Request(url.href, { method, headers: req.headers(), body: req.postData() ?? '' }), this.planPorts())
      this.planCalls.push({ action: String(body.action), status: res.status, body })
      return route.fulfill({ status: res.status, headers: { ...cors, 'content-type': 'application/json' }, body: await res.text() })
    }
    const m = p.match(/^\/rest\/v1\/(planner_\w+)$/)
    if (m) {
      const table = m[1]
      if ((AI_TABLES as readonly string[]).includes(table) && !this.ai)
        return json(404, { code: 'PGRST205', details: null, hint: null, message: `Could not find the table 'public.${table}' in the schema cache` })
      if (table === 'planner_push_subscriptions') {
        const subs = this.rows.planner_push_subscriptions
        if (method === 'POST') {
          const body = JSON.parse(req.postData() ?? '[]')
          for (const r of Array.isArray(body) ? body : [body]) subs.set(r.endpoint, { ...subs.get(r.endpoint), ...r, user_id: TEST_USER.id })
          return route.fulfill({ status: 201, headers: cors })
        }
        if (method === 'DELETE') {
          subs.delete((url.searchParams.get('endpoint') ?? '').replace(/^eq\./, ''))
          return route.fulfill({ status: 204, headers: cors })
        }
        if (method === 'GET') return json(200, [...subs.values()])
      }
      if (table === 'planner_calendar_accounts_public' && method === 'GET')
        return json(200, [...this.rows.planner_calendar_accounts.values()].map(({ secret_enc: _s, ...rest }) => rest))
      if (table === 'planner_calendar_accounts' && (method === 'PATCH' || method === 'DELETE')) {
        const id = (url.searchParams.get('id') ?? '').replace(/^eq\./, '')
        if (method === 'DELETE') {
          this.rows.planner_calendar_accounts.delete(id)
          for (const [k, e] of this.rows.planner_events) if (e.account_id === id) this.rows.planner_events.delete(k) // cascade, no log
        } else Object.assign(this.rows.planner_calendar_accounts.get(id) ?? {}, JSON.parse(req.postData() ?? '{}'))
        return route.fulfill({ status: 204, headers: cors })
      }
      if (method === 'POST' && ([...TABLES, ...AI_TABLES] as readonly string[]).includes(table)) {
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

  /** Ports for the real plan-day handler over this fake's tables, with the scripted model. */
  private planPorts(): PlanPorts {
    const need = () => {
      if (!this.ai) throw new PlannerUnavailable('relation "planner_ai_plans" does not exist')
    }
    const live = (t: string) => [...this.rows[t].values()].filter((r) => !r.deleted_at)
    return {
      model: 'claude-sonnet-5-5',
      newId: () => {
        const hex = Date.now().toString(16).padStart(12, '0')
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-7${crypto.randomUUID().slice(15)}`
      },
      now: this.now,
      userFromJwt: async (jwt) => {
        try {
          return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).sub ?? null
        } catch {
          return null
        }
      },
      dayContext: async (_u, from, to) => {
        const s = (this.rows.planner_settings.values().next().value?.data ?? {}) as Record<string, number>
        return {
          settings: { day_start: s.day_start ?? 360, day_end: s.day_end ?? 1320, default_duration: s.default_duration ?? 30 },
          categories: live('planner_categories').map((c) => ({ id: String(c.id), name: String(c.name) })),
          tasks: live('planner_tasks')
            .filter((t) => t.start_at && !t.rrule && String(t.start_at) >= from && String(t.start_at) < to)
            .map((t) => ({ title: String(t.title), start_at: String(t.start_at), duration_min: Number(t.duration_min), category_id: (t.category_id as string) ?? null, priority: Number(t.priority), done: !!t.completed_at })),
          events: live('planner_events')
            .filter((e) => String(e.start_at) < to && String(e.end_at) > from)
            .map((e) => ({ title: String(e.title), start_at: String(e.start_at), end_at: String(e.end_at), all_day: !!e.all_day })),
        }
      },
      profile: async () => (need(), (this.rows.planner_ai_profile.values().next().value as unknown as ProfileRow) ?? null),
      countPlansSince: async (_u, since) => (need(), [...this.rows.planner_ai_plans.keys()].filter((id) => id >= since).length),
      getPlan: async (_u, id) => (need(), (this.rows.planner_ai_plans.get(id) as unknown as PlanRow) ?? null),
      upsertPlan: async (row) => {
        need()
        this.upsert('planner_ai_plans', row as unknown as Row)
        return { ...this.rows.planner_ai_plans.get(row.id) } as unknown as PlanRow
      },
      upsertProfile: async (row) => {
        need()
        this.upsert('planner_ai_profile', row as unknown as Row)
      },
      create: (body) => this.model.create(body),
    }
  }

  /** Ports for the real calendar handlers, over this fake's tables (events go through the sync log like press). */
  private ports(): Ports {
    const events = this.rows.planner_events
    const logEvent = (row: Row) => {
      const entry = { seq: this.log.length + 1, user_id: TEST_USER.id, table_name: 'planner_events', row_id: String(row.id), op: 'update', at: new Date().toISOString() }
      this.log.push(entry)
      this.broadcast(entry)
    }
    return {
      kek: TEST_KEK,
      cronSecret: TEST_CRON,
      fetch: this.caldav.fetch,
      newId: () => crypto.randomUUID(),
      userFromJwt: async (jwt) => {
        try {
          return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).sub ?? null
        } catch {
          return null
        }
      },
      insertAccount: async (row: AccountRow) => void this.rows.planner_calendar_accounts.set(row.id, { ...row } as Row),
      accounts: async (userId) => [...this.rows.planner_calendar_accounts.values()].filter((a) => !userId || a.user_id === userId) as unknown as AccountRow[],
      updateAccount: async (id, patch) => void Object.assign(this.rows.planner_calendar_accounts.get(id) ?? {}, patch),
      eventKeys: async (accountId) =>
        new Map([...events.values()].filter((e) => e.account_id === accountId && !e.deleted_at).map((e) => [eventKey(String(e.calendar_href), String(e.uid)), `${e.etag}|${e.start_at}|${e.end_at}|${e.title}`])),
      upsertEvents: async (rows: EventRow[]) => {
        for (const r of rows) {
          const k = `${r.account_id}|${eventKey(r.calendar_href, r.uid)}`
          const row = { ...r, id: events.get(k)?.id ?? crypto.randomUUID(), updated_at: new Date().toISOString() } as Row
          events.set(k, row)
          logEvent(row)
        }
      },
      tombstoneEvents: async (accountId, keys) => {
        for (const key of keys) {
          const row = events.get(`${accountId}|${key}`)
          if (!row) continue
          row.deleted_at = new Date().toISOString()
          logEvent(row)
        }
      },
      // two-way (arc 4): the real twoWay() over this fake's planner_tasks (merge + sync log like press) and links
      tasksForPush: async (_u, fromIso) =>
        [...this.rows.planner_tasks.values()].filter((t) => t.start_at && Date.parse(String(t.start_at)) >= Date.parse(fromIso) && !t.rrule && !t.series_id && !t.deleted_at).map((t) => ({ ...t }) as unknown as TaskRow),
      tasksByIds: async (_u, ids) => ids.map((id) => this.rows.planner_tasks.get(id)).filter(Boolean).map((t) => ({ ...t }) as unknown as TaskRow),
      links: async (accountId) => [...this.calLinks.values()].filter((l) => l.account_id === accountId).map((l) => ({ ...l })),
      upsertLink: async (row) => void this.calLinks.set(row.task_id, { ...row }),
      deleteLink: async (taskId) => void this.calLinks.delete(taskId),
      writeTask: async (_u, id, fields, ts) => {
        const field_ts = Object.fromEntries([...Object.keys(fields), 'device_id'].map((k) => [k, ts]))
        this.upsert('planner_tasks', { id, ...fields, device_id: 'calendar-sync', field_ts })
        return Number(this.rows.planner_tasks.get(id)!.version)
      },
      userTz: async () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    }
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
