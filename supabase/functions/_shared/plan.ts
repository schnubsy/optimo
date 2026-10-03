// plan-day — the AI planning layer (arc 3) as a plain Request → Response handler over ports, so the Deno entry
// (plan-day/index.ts: supabase-js with the CALLER's JWT, so RLS applies; the Anthropic SDK) and the hermetic
// Playwright fake (tests/support/fakeSupabase.ts) run the same code (lessons 2026-09-27 [supabase]).
//
// Actions (POST JSON, user JWT):
//   propose {date, from, to, tz, intent, mode, research, plan_id?, answers?} → a planner_ai_plans row (status draft)
//   learn   {plan_id, accepted_task_ids, edits, rejected}                     → planner_ai_profile.data distilled
//
// Privacy: the model sees titles, times, durations, categories and priorities only — never notes, calendar
// credentials or device ids. The intent text is never logged.

export const DEFAULT_MODEL = 'claude-sonnet-5-5'
export const LEARN_MODEL = 'claude-haiku-4-5'
export const DAILY_LIMIT = 30
export const MAX_QUESTIONS = 3
export const MAX_CONTINUATIONS = 3
export const WEB_SEARCH_MAX_USES = 3

export type Priority = 0 | 1 | 2 | 3
export interface PlanBlock {
  title: string
  start_at: string // ISO, UTC
  duration_min: number
  category_id: string | null
  priority: Priority | null
  why: string
}
export interface Proposal {
  blocks: PlanBlock[]
  questions: string[]
  notes: string
}
export interface Source {
  query: string
  url: string
  title: string
  snippet: string
}
export interface PlanRow {
  id: string
  user_id: string
  plan_date: string
  intent: string
  mode: 'propose' | 'auto'
  status: 'draft' | 'accepted' | 'rejected' | 'applied' | 'failed'
  proposal: Proposal
  research: Source[]
  model: string | null
  accepted_task_ids: string[]
  deleted_at: string | null
  field_ts: Record<string, number>
  device_id: string | null
  updated_at?: string
  version?: number
}
export interface ProfileData {
  tone?: string
  day_shape?: string
  preferred_block_min?: number
  buffers?: string
  habits?: string[]
  avoid?: string[]
}
export interface ProfileRow {
  id: string
  user_id: string
  data: ProfileData
  accepted_count: number
  deleted_at: string | null
  field_ts: Record<string, number>
  device_id: string | null
}

/** Just what planning needs from the caller's day — no notes, no credentials, no device ids. */
export interface DayContext {
  settings: { day_start: number; day_end: number; default_duration: number }
  categories: { id: string; name: string }[]
  tasks: { title: string; start_at: string; duration_min: number; category_id: string | null; priority: number; done: boolean }[]
  events: { title: string; start_at: string; end_at: string; all_day: boolean }[]
}

/** The subset of a Messages API response the handler reads (the Deno port returns the SDK's Message). */
export interface ModelBlock {
  type: string
  text?: string
  name?: string
  input?: unknown
  content?: unknown
  citations?: { type: string; url?: string; title?: string; cited_text?: string }[] | null
}
export interface ModelMessage {
  stop_reason: string | null
  content: ModelBlock[]
  model?: string
}
export class ModelError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** The planner tables are not there yet (db/004_ai.sql not applied): the client shows "Planner isn't connected yet". */
export class PlannerUnavailable extends Error {}

export interface PlanPorts {
  model: string // PLANNER_MODEL or DEFAULT_MODEL
  userFromJwt(jwt: string): Promise<string | null>
  dayContext(userId: string, fromIso: string, toIso: string): Promise<DayContext>
  profile(userId: string): Promise<ProfileRow | null>
  countPlansSince(userId: string, sinceId: string): Promise<number>
  getPlan(userId: string, id: string): Promise<PlanRow | null>
  upsertPlan(row: PlanRow): Promise<PlanRow>
  upsertProfile(row: ProfileRow): Promise<void>
  /** One Messages API call (the port owns the timeout); throws ModelError(status) on an API error. */
  create(body: Record<string, unknown>): Promise<ModelMessage>
  newId(): string // uuid v7
  now(): Date
  log?(msg: string): void
}

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })
const bearer = (req: Request) => req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''

/** The smallest uuid v7 for an instant: ids minted at or after `t` sort ≥ this (plans are counted by id). */
export function uuidv7Floor(t: Date): string {
  const hex = t.getTime().toString(16).padStart(12, '0')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-7000-8000-000000000000`
}

// ---------- prompt ----------

const SYSTEM = `You plan one day for Mark in optimo, a personal day planner. You turn his written intent into scheduled
time blocks, and you are a candid planning partner, not a yes-man.

- Respect what is already fixed: existing tasks and calendar events stay where they are. Never place a block over an
  event; overlap an existing task only when the intent asks you to.
- Challenge the plan where it deserves it: flag overcommitment (more work than the free time holds), missing buffers
  (back-to-back blocks, no breaks, no travel or transition time), conflicts and unrealistic durations, in "notes".
  If the honest answer is that the day cannot hold everything, say so and plan the most important part.
- Ask at most ${MAX_QUESTIONS} short questions, only where an answer would materially change the plan; otherwise ask none.
- Every block carries a one-sentence "why" that ties it to the intent or to a constraint.
- Use local wall-clock times on the requested date ("YYYY-MM-DDTHH:MM", no zone) inside the day bounds, durations
  in whole minutes (5-minute multiples), a category id from the list or null, priority 0-3 or null.
- Follow the learned planning style when one is given, unless the intent says otherwise.
- When web research is available, use it only for facts the plan depends on (opening hours, travel times, event
  dates) and mention what you relied on in "notes".
- Finish by calling submit_plan exactly once. Do not answer in plain text.`

const PLAN_TOOL = {
  name: 'submit_plan',
  description: 'Submit the proposed day plan. Call exactly once, as the final step.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['blocks', 'questions', 'notes'],
    properties: {
      blocks: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'start_at', 'duration_min', 'category_id', 'priority', 'why'],
          properties: {
            title: { type: 'string', description: 'Short task title, as Mark would write it.' },
            start_at: { type: 'string', description: 'Local wall-clock start on the plan date, "YYYY-MM-DDTHH:MM".' },
            duration_min: { type: 'integer', description: 'Whole minutes, a multiple of 5.' },
            category_id: { type: ['string', 'null'], description: 'One of the listed category ids, or null.' },
            priority: { type: ['integer', 'null'], description: '0 none, 1 low, 2 medium, 3 high; or null.' },
            why: { type: 'string', description: 'One sentence: why this block, why here.' },
          },
        },
      },
      questions: { type: 'array', items: { type: 'string' }, description: `At most ${MAX_QUESTIONS} questions; empty when none are needed.` },
      notes: { type: 'string', description: 'Candid notes: overcommitment, missing buffers, conflicts, research relied on.' },
    },
  },
}

const LEARN_TOOL = {
  name: 'save_profile',
  description: 'Save the updated planning-style profile.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['tone', 'day_shape', 'preferred_block_min', 'buffers', 'habits', 'avoid'],
    properties: {
      tone: { type: 'string', description: 'How Mark likes plans framed (e.g. terse, challenging).' },
      day_shape: { type: 'string', description: 'When deep work, meetings, admin and rest tend to land.' },
      preferred_block_min: { type: 'integer', description: 'Typical focused block length in minutes.' },
      buffers: { type: 'string', description: 'How much slack he keeps between blocks.' },
      habits: { type: 'array', items: { type: 'string' }, maxItems: 8 },
      avoid: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    },
  },
}

/** Local "HH:MM" of an instant in a zone. */
function clock(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso))
}
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

export function contextText(date: string, tz: string, ctx: DayContext, profile: ProfileData | null): string {
  const cat = new Map(ctx.categories.map((c) => [c.id, c.name]))
  const lines = [
    `Plan date: ${date} (${tz}). Day bounds ${hhmm(ctx.settings.day_start)}–${hhmm(ctx.settings.day_end)}; default block ${ctx.settings.default_duration} min.`,
    `Categories (id: name): ${ctx.categories.map((c) => `${c.id}: ${c.name}`).join('; ') || 'none'}`,
    'Already on the day (fixed):',
    ...ctx.tasks.map((t) => `- task ${clock(t.start_at, tz)} ${t.duration_min} min "${t.title}"${t.category_id ? ` [${cat.get(t.category_id) ?? 'uncategorised'}]` : ''}${t.priority ? ` p${t.priority}` : ''}${t.done ? ' (done)' : ''}`),
    ...ctx.events.map((e) => (e.all_day ? `- event all day "${e.title}"` : `- event ${clock(e.start_at, tz)}–${clock(e.end_at, tz)} "${e.title}"`)),
  ]
  if (!ctx.tasks.length && !ctx.events.length) lines.push('- nothing yet')
  if (profile && Object.keys(profile).length) lines.push(`Learned planning style: ${JSON.stringify(profile)}`)
  return lines.join('\n')
}

// ---------- output validation ----------

/** Turn the model's local "YYYY-MM-DDTHH:MM" into UTC by offset from the day's local midnight (`from`). */
function localToIso(local: unknown, date: string, fromIso: string): string | null {
  const m = typeof local === 'string' ? /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(local) : null
  if (!m || m[1] !== date) return null
  const min = Number(m[2]) * 60 + Number(m[3])
  if (min < 0 || min >= 24 * 60) return null
  return new Date(new Date(fromIso).getTime() + min * 60_000).toISOString()
}

/** Validate the submit_plan input; malformed blocks are dropped, a malformed whole is null. */
export function cleanProposal(input: unknown, date: string, fromIso: string, toIso: string, catIds: Set<string>): Proposal | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as { blocks?: unknown; questions?: unknown; notes?: unknown }
  if (!Array.isArray(raw.blocks)) return null
  const end = new Date(toIso).getTime()
  const blocks: PlanBlock[] = []
  for (const b of raw.blocks as Record<string, unknown>[]) {
    if (!b || typeof b !== 'object') continue
    const title = typeof b.title === 'string' ? b.title.trim().slice(0, 200) : ''
    const start_at = localToIso(b.start_at, date, fromIso)
    let duration = Math.round(Number(b.duration_min) / 5) * 5
    if (!title || !start_at || !Number.isFinite(duration) || duration < 5) continue
    duration = Math.min(duration, Math.max(5, Math.floor((end - new Date(start_at).getTime()) / 60_000)))
    const p = Number(b.priority)
    blocks.push({
      title,
      start_at,
      duration_min: duration,
      category_id: typeof b.category_id === 'string' && catIds.has(b.category_id) ? b.category_id : null,
      priority: [0, 1, 2, 3].includes(p) ? (p as Priority) : null,
      why: typeof b.why === 'string' ? b.why.trim().slice(0, 300) : '',
    })
  }
  if (!blocks.length && !(Array.isArray(raw.questions) && raw.questions.length)) return null
  blocks.sort((a, b) => a.start_at.localeCompare(b.start_at))
  const questions = (Array.isArray(raw.questions) ? raw.questions : []).filter((q): q is string => typeof q === 'string' && !!q.trim()).map((q) => q.trim().slice(0, 300)).slice(0, MAX_QUESTIONS)
  return { blocks, questions, notes: typeof raw.notes === 'string' ? raw.notes.trim().slice(0, 2000) : '' }
}

/** Sources from web search: queries from server_tool_use, results from web_search_tool_result, snippets from citations. */
export function collectSources(content: ModelBlock[]): Source[] {
  const queries = new Map<string, string>()
  const snippets = new Map<string, string>()
  const out = new Map<string, Source>()
  for (const b of content) {
    if (b.type === 'server_tool_use' && b.name === 'web_search') {
      const q = (b.input as { query?: string } | undefined)?.query
      if (q) queries.set((b as { id?: string }).id ?? '', q)
    }
    if (b.type === 'text') for (const c of b.citations ?? []) if (c.url && c.cited_text && !snippets.has(c.url)) snippets.set(c.url, c.cited_text.slice(0, 300))
  }
  for (const b of content) {
    if (b.type !== 'web_search_tool_result' || !Array.isArray(b.content)) continue // an error result is an object
    const query = queries.get((b as { tool_use_id?: string }).tool_use_id ?? '') ?? ''
    for (const r of b.content as { type: string; url?: string; title?: string }[]) {
      if (r.type !== 'web_search_result' || !r.url || out.has(r.url)) continue
      out.set(r.url, { query, url: r.url, title: r.title ?? r.url, snippet: '' })
    }
  }
  for (const s of out.values()) s.snippet = snippets.get(s.url) ?? ''
  // cited sources first: they are the ones the plan leaned on
  return [...out.values()].sort((a, b) => Number(!!b.snippet) - Number(!!a.snippet)).slice(0, 8)
}

// ---------- model calls ----------

/** One call with one retry on 429 / 5xx / timeout (status 0). */
async function call(p: PlanPorts, body: Record<string, unknown>): Promise<ModelMessage> {
  try {
    return await p.create(body)
  } catch (e) {
    const s = e instanceof ModelError ? e.status : 0
    if (s === 0 || s === 429 || s >= 500) return await p.create(body)
    throw e
  }
}

/** Propose: loops over pause_turn (server web search) until submit_plan is called; one nudge if the model answers in text. */
async function runPlanner(p: PlanPorts, userText: string, research: boolean): Promise<{ input: unknown; content: ModelBlock[]; model: string }> {
  const tools: Record<string, unknown>[] = [PLAN_TOOL]
  if (research) tools.unshift({ type: 'web_search_20260209', name: 'web_search', max_uses: WEB_SEARCH_MAX_USES })
  const messages: { role: string; content: unknown }[] = [{ role: 'user', content: userText }]
  const all: ModelBlock[] = []
  let nudged = false
  for (let i = 0; i <= MAX_CONTINUATIONS + 1; i++) {
    const res = await call(p, {
      model: p.model,
      max_tokens: 16000,
      system: SYSTEM,
      tools,
      // forced tool_choice is a 400 on the current models: auto + the system instruction + strict schema
      tool_choice: { type: 'auto' },
      output_config: { effort: 'medium' },
      messages,
    })
    all.push(...res.content)
    const use = res.content.find((b) => b.type === 'tool_use' && b.name === 'submit_plan')
    if (use) return { input: use.input, content: all, model: res.model ?? p.model }
    if (res.stop_reason === 'refusal') break
    if (res.stop_reason === 'pause_turn') {
      // resume: re-send with the paused assistant turn; no extra user message
      messages.push({ role: 'assistant', content: res.content })
      continue
    }
    if (nudged) break
    nudged = true
    messages.push({ role: 'assistant', content: res.content }, { role: 'user', content: 'Call submit_plan now with the plan.' })
  }
  return { input: null, content: all, model: p.model }
}

// ---------- handler ----------

interface ProposeBody {
  action: 'propose'
  date?: string
  from?: string
  to?: string
  tz?: string
  intent?: string
  mode?: 'propose' | 'auto'
  research?: boolean
  plan_id?: string
  answers?: { question: string; answer: string }[]
}
interface LearnBody {
  action: 'learn'
  plan_id?: string
  accepted_task_ids?: string[]
  edits?: { before: Partial<PlanBlock>; after: Partial<PlanBlock> }[]
  rejected?: Partial<PlanBlock>[]
}

const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const isIso = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v))
const validTz = (tz: unknown): string => {
  try {
    if (typeof tz === 'string' && tz) {
      new Intl.DateTimeFormat('en', { timeZone: tz })
      return tz
    }
  } catch {
    /* fall through */
  }
  return 'UTC'
}

export async function handlePlan(req: Request, p: PlanPorts): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'POST only' })
  const userId = await p.userFromJwt(bearer(req))
  if (!userId) return json(401, { error: 'Sign in first.' })
  let body: ProposeBody | LearnBody
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Expected JSON.' })
  }
  try {
    if (body.action === 'propose') return await propose(body, userId, p)
    if (body.action === 'learn') return await learn(body, userId, p)
    return json(400, { error: 'Unknown action.' })
  } catch (e) {
    if (e instanceof PlannerUnavailable) return json(503, { code: 'not_connected', error: 'Planner isn’t connected yet.' })
    // never log the intent — only the failure class
    const status = e instanceof ModelError ? e.status : 0
    p.log?.(`plan-day: ${body.action} failed (${status || (e as Error).name})`)
    if (status === 429 || status === 529) return json(503, { error: 'The planner is busy — try again in a minute.' })
    return json(502, { error: 'The planner couldn’t be reached — try again in a moment.' })
  }
}

async function propose(b: ProposeBody, userId: string, p: PlanPorts): Promise<Response> {
  const intent = typeof b.intent === 'string' ? b.intent.trim() : ''
  if (!isDate(b.date) || !isIso(b.from) || !isIso(b.to) || !intent) return json(400, { error: 'A date and a few words of intent are needed.' })
  if (intent.length > 4000) return json(400, { error: 'That intent is too long — keep it under 4000 characters.' })
  const now = p.now()
  const existing = b.plan_id ? await p.getPlan(userId, b.plan_id) : null
  if (!existing) {
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    if ((await p.countPlansSince(userId, uuidv7Floor(today))) >= DAILY_LIMIT)
      return json(429, { error: `That’s ${DAILY_LIMIT} plans today — the planner resets at midnight UTC.` })
  }
  const tz = validTz(b.tz)
  const [ctx, profile] = await Promise.all([p.dayContext(userId, b.from, b.to), p.profile(userId)])
  const answers = (b.answers ?? []).filter((a) => a && typeof a.answer === 'string' && a.answer.trim())
  const text = [
    contextText(b.date, tz, ctx, profile && !profile.deleted_at ? profile.data : null),
    '',
    `Intent:\n${intent}`,
    ...(answers.length ? ['', 'Answers to your earlier questions:', ...answers.map((a) => `- ${String(a.question).slice(0, 300)} → ${a.answer.trim().slice(0, 500)}`)] : []),
  ].join('\n')
  const run = await runPlanner(p, text, !!b.research)
  const proposal = cleanProposal(run.input, b.date, b.from, b.to, new Set(ctx.categories.map((c) => c.id)))
  if (!proposal) return json(502, { error: 'The planner returned an unusable plan — try rephrasing.' })
  const ts = now.getTime()
  const row: PlanRow = {
    id: existing?.id ?? b.plan_id ?? p.newId(),
    user_id: userId,
    plan_date: b.date,
    intent,
    mode: b.mode === 'auto' ? 'auto' : 'propose',
    status: 'draft',
    proposal,
    research: b.research ? collectSources(run.content) : [],
    model: run.model,
    accepted_task_ids: [],
    deleted_at: null,
    field_ts: Object.fromEntries(['plan_date', 'intent', 'mode', 'status', 'proposal', 'research', 'model', 'accepted_task_ids', 'deleted_at'].map((k) => [k, ts])),
    device_id: 'plan-day',
  }
  return json(200, await p.upsertPlan(row))
}

async function learn(b: LearnBody, userId: string, p: PlanPorts): Promise<Response> {
  if (typeof b.plan_id !== 'string') return json(400, { error: 'plan_id is needed.' })
  const plan = await p.getPlan(userId, b.plan_id)
  if (!plan) return json(404, { error: 'No such plan.' })
  const prev = await p.profile(userId)
  const live = prev && !prev.deleted_at ? prev : null
  const accepted = new Set(b.accepted_task_ids ?? [])
  const brief = (x: Partial<PlanBlock>) => ({ title: x.title, start_at: x.start_at, duration_min: x.duration_min, category_id: x.category_id ?? null })
  const text = [
    `Current profile: ${JSON.stringify(live?.data ?? {})}`,
    `Proposed blocks: ${JSON.stringify(plan.proposal.blocks.map(brief))}`,
    `Edited before accepting: ${JSON.stringify((b.edits ?? []).map((e) => ({ before: brief(e.before ?? {}), after: brief(e.after ?? {}) })))}`,
    `Not accepted: ${JSON.stringify((b.rejected ?? []).map(brief))}`,
    `Accepted ${accepted.size} block(s).`,
    'Update the profile: keep what still holds, fold in what these choices show, stay general (no one-off titles). Call save_profile.',
  ].join('\n')
  const res = await call(p, {
    model: LEARN_MODEL,
    max_tokens: 1024,
    system: 'You maintain a short planning-style profile for one person from the plans they accept and edit.',
    tools: [LEARN_TOOL],
    tool_choice: { type: 'tool', name: 'save_profile' },
    messages: [{ role: 'user', content: text }],
  })
  const use = res.content.find((x) => x.type === 'tool_use' && x.name === 'save_profile')
  const d = (use?.input ?? null) as ProfileData | null
  if (!d || typeof d !== 'object') return json(502, { error: 'The planner couldn’t update what it learned.' })
  const data: ProfileData = {
    tone: String(d.tone ?? '').slice(0, 200),
    day_shape: String(d.day_shape ?? '').slice(0, 300),
    preferred_block_min: Math.max(5, Math.min(240, Math.round(Number(d.preferred_block_min) || 45))),
    buffers: String(d.buffers ?? '').slice(0, 200),
    habits: (Array.isArray(d.habits) ? d.habits : []).map((h) => String(h).slice(0, 120)).slice(0, 8),
    avoid: (Array.isArray(d.avoid) ? d.avoid : []).map((h) => String(h).slice(0, 120)).slice(0, 8),
  }
  const ts = p.now().getTime()
  const row: ProfileRow = {
    id: prev?.id ?? p.newId(),
    user_id: userId,
    data,
    accepted_count: (live?.accepted_count ?? 0) + 1,
    deleted_at: null, // learning after a Reset starts a fresh profile on the same row
    field_ts: { data: ts, accepted_count: ts, deleted_at: ts },
    device_id: 'plan-day',
  }
  await p.upsertProfile(row)
  return json(200, { data, accepted_count: row.accepted_count })
}
