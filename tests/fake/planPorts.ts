// A hermetic stand-in for the Messages API and press tables behind plan-day (arc 3). Used by the deno tests
// (supabase/functions/_shared/plan_test.ts), vitest and — through tests/support/fakeSupabase.ts — Playwright, so all
// three drive the same handler against the same scripted model. Runtime-neutral: no node or Deno imports.
import type { DayContext, ModelBlock, ModelMessage, PlanPorts, PlanRow, ProfileRow } from '../../supabase/functions/_shared/plan.ts'
import { ModelError } from '../../supabase/functions/_shared/plan.ts'

type Body = Record<string, unknown> & { messages: { role: string; content: unknown }[]; tools?: { name?: string; type?: string }[]; model: string }

export const FAKE_SOURCE = { url: 'https://example.org/pool-hours', title: 'Harbour Pool — opening hours', cited: 'Open 06:00–20:00 on weekdays.' }

/** The text of the first user message (the planning context + intent). */
const userText = (b: Body) => {
  const c = b.messages[0]?.content
  return typeof c === 'string' ? c : ''
}
const planDate = (t: string) => /Plan date: (\d{4}-\d{2}-\d{2})/.exec(t)?.[1] ?? '2026-01-01'
const firstCat = (t: string) => /Categories \(id: name\): ([0-9a-f-]{36}):/.exec(t)?.[1] ?? null

function toolUse(name: string, input: unknown): ModelBlock {
  return { type: 'tool_use', name, input, ...({ id: `toolu_${name}` } as object) }
}

/** The default scripted planner: three blocks shaped by the intent, a question when the intent asks for one. */
export function scriptedPlan(b: Body): ModelMessage {
  const t = userText(b)
  const d = planDate(t)
  const intent = (/Intent:\n([\s\S]*?)(\n\n|$)/.exec(t)?.[1] ?? '').trim()
  if (/#malformed/.test(intent)) return { stop_reason: 'tool_use', content: [toolUse('submit_plan', { blocks: 'not-an-array', notes: 1 })] }
  const answered = /Answers to your earlier questions/.test(t)
  const blocks = [
    { title: `Focus: ${intent.split(/[.,\n]/)[0].slice(0, 40) || 'deep work'}`, start_at: `${d}T09:00`, duration_min: 90, category_id: firstCat(t), priority: 3, why: 'Your intent leads with this, so it gets the freshest hours.' },
    { title: 'Walk + reset', start_at: `${d}T10:30`, duration_min: 15, category_id: null, priority: null, why: 'A buffer so the morning block doesn’t run straight into the next thing.' },
    { title: answered ? 'Admin & email (short)' : 'Admin & email', start_at: `${d}T13:30`, duration_min: answered ? 30 : 45, category_id: null, priority: 1, why: 'Batched after lunch, when focus is lowest.' },
  ]
  const questions = /\?/.test(intent) && !answered ? ['Is the 13:30 admin block movable if the morning runs over?'] : []
  return {
    stop_reason: 'tool_use',
    model: b.model,
    content: [toolUse('submit_plan', { blocks, questions, notes: 'You have more than the free time holds — I dropped the lowest-value item and kept a 15-minute buffer after the focus block.' })],
  }
}

export interface FakeModelOpts {
  /** answer in plain text first; the handler must nudge once */
  textFirst?: boolean
  /** throw ModelError(status) this many times before succeeding */
  failWith?: { status: number; times: number }
}

export class FakeModel {
  calls: Body[] = []
  opts: FakeModelOpts
  constructor(opts: FakeModelOpts = {}) {
    this.opts = opts
  }
  create = async (raw: Record<string, unknown>): Promise<ModelMessage> => {
    const b = structuredClone(raw) as Body
    this.calls.push(b)
    const f = this.opts.failWith
    if (f && f.times > 0) {
      f.times--
      throw new ModelError(f.status, `fake ${f.status}`)
    }
    if ((b.tools ?? []).some((t) => t.name === 'save_profile')) {
      return {
        stop_reason: 'tool_use',
        content: [toolUse('save_profile', { tone: 'direct, challenge me', day_shape: 'deep work before 11, admin after lunch', preferred_block_min: 75, buffers: '15 min after long blocks', habits: ['walk mid-morning'], avoid: ['meetings before 10'] })],
      }
    }
    const research = (b.tools ?? []).some((t) => t.type?.startsWith('web_search'))
    const turns = b.messages.length
    if (research && turns === 1) {
      // the server sampling loop pauses after the search; the handler re-sends with this turn appended
      return {
        stop_reason: 'pause_turn',
        content: [
          { type: 'server_tool_use', name: 'web_search', input: { query: 'Harbour Pool opening hours' }, ...({ id: 'srvtoolu_1' } as object) },
          { type: 'web_search_tool_result', content: [{ type: 'web_search_result', url: FAKE_SOURCE.url, title: FAKE_SOURCE.title }], ...({ tool_use_id: 'srvtoolu_1' } as object) },
        ],
      }
    }
    if (this.opts.textFirst && !b.messages.some((m) => m.role === 'assistant')) return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Here is a plan…' }] }
    const plan = scriptedPlan(b)
    if (research) plan.content.unshift({ type: 'text', text: 'The pool opens at 06:00.', citations: [{ type: 'web_search_result_location', url: FAKE_SOURCE.url, title: FAKE_SOURCE.title, cited_text: FAKE_SOURCE.cited }] })
    return plan
  }
}

export const PLAN_USER = 'user-mark'

/** In-memory PlanPorts (deno test + vitest). Playwright's fake implements the same over its PostgREST tables. */
export class MemPlanPorts implements PlanPorts {
  model = 'claude-sonnet-5-5'
  plans = new Map<string, PlanRow>()
  profiles = new Map<string, ProfileRow>()
  logs: string[] = []
  ctx: DayContext = {
    settings: { day_start: 360, day_end: 1320, default_duration: 30 },
    categories: [{ id: '0190a000-0000-7000-8000-000000000001', name: 'Work' }],
    tasks: [{ title: 'Standup', start_at: '2026-10-05T11:00:00.000Z', duration_min: 30, category_id: null, priority: 0, done: false }],
    events: [],
  }
  fake: FakeModel
  clock: Date
  private n = 0
  constructor(fake = new FakeModel(), now = new Date('2026-10-05T07:00:00.000Z')) {
    this.fake = fake
    this.clock = now
  }
  /** uuid v7-shaped ids that sort by the fake clock */
  newId = () => {
    const hex = this.clock.getTime().toString(16).padStart(12, '0')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-7000-8000-${String(++this.n).padStart(12, '0')}`
  }
  now = () => this.clock
  log = (m: string) => void this.logs.push(m)
  userFromJwt = async (jwt: string) => (jwt === 'jwt-mark' ? PLAN_USER : null)
  dayContext = async () => structuredClone(this.ctx)
  profile = async (userId: string) => this.profiles.get(userId) ?? null
  countPlansSince = async (userId: string, sinceId: string) => [...this.plans.values()].filter((p) => p.user_id === userId && p.id >= sinceId).length
  getPlan = async (userId: string, id: string) => {
    const p = this.plans.get(id)
    return p && p.user_id === userId ? structuredClone(p) : null
  }
  upsertPlan = async (row: PlanRow) => {
    const prev = this.plans.get(row.id)
    const out = { ...row, version: (prev?.version ?? 0) + 1, updated_at: this.clock.toISOString() }
    this.plans.set(row.id, out)
    return structuredClone(out)
  }
  upsertProfile = async (row: ProfileRow) => void this.profiles.set(row.user_id, structuredClone(row))
  create = (body: Record<string, unknown>) => this.fake.create(body)
}
