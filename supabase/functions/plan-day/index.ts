// POST {action: 'propose' | 'learn', …} with the user's JWT (verify_jwt = true). Every database read and write goes
// through supabase-js carrying the CALLER's JWT, so RLS scopes it to their rows; only the model call uses a secret
// (ANTHROPIC_API_KEY, already set on press). PLANNER_MODEL optionally overrides the default model.
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_MODEL, ModelError, PlannerUnavailable, handlePlan, type DayContext, type ModelMessage, type PlanPorts, type PlanRow, type ProfileRow } from '../_shared/plan.ts'

const env = (k: string) => Deno.env.get(k) ?? ''
const anthropic = new Anthropic({ apiKey: env('ANTHROPIC_API_KEY'), timeout: 45_000, maxRetries: 0 }) // the handler retries once itself
// server-side refusal fallback (routes by refusal category) on the models that accept it
const FALLBACK_MODELS = new Set(['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1'])

// PGRST205 / 42P01: planner_ai_* not created yet (db/004_ai.sql not yet applied)
const missing = (e: { code?: string; message: string }) => e.code === 'PGRST205' || e.code === '42P01' || /does not exist|schema cache/i.test(e.message)
const must = <T>(r: { data: T; error: { code?: string; message: string } | null }) => {
  if (r.error) throw missing(r.error) ? new PlannerUnavailable(r.error.message) : new Error(r.error.message)
  return r.data
}

/** uuid v7 (time-ordered) — plans are counted per day by id range (handlePlan → countPlansSince). */
function uuidv7(): string {
  const b = crypto.getRandomValues(new Uint8Array(16))
  const ts = Date.now()
  for (let i = 0; i < 6; i++) b[i] = Math.floor(ts / 2 ** (8 * (5 - i))) & 0xff
  b[6] = (b[6] & 0x0f) | 0x70
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

function ports(jwt: string): PlanPorts {
  const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
  const model = env('PLANNER_MODEL') || DEFAULT_MODEL
  return {
    model,
    newId: uuidv7,
    now: () => new Date(),
    log: (m) => console.log(m),
    async userFromJwt(token) {
      if (!token) return null
      const { data } = await sb.auth.getUser(token)
      return data.user?.id ?? null
    },
    async dayContext(_userId, from, to): Promise<DayContext> {
      const [settings, cats, tasks, events] = await Promise.all([
        sb.from('planner_settings').select('data').maybeSingle(),
        sb.from('planner_categories').select('id,name').is('deleted_at', null).order('sort_key'),
        sb.from('planner_tasks').select('title,start_at,duration_min,category_id,priority,completed_at').gte('start_at', from).lt('start_at', to).is('deleted_at', null).is('rrule', null),
        sb.from('planner_events').select('title,start_at,end_at,all_day').lt('start_at', to).gt('end_at', from).is('deleted_at', null),
      ])
      const s = (must(settings) as { data?: Record<string, number> } | null)?.data ?? {}
      return {
        settings: { day_start: s.day_start ?? 360, day_end: s.day_end ?? 1320, default_duration: s.default_duration ?? 30 },
        categories: must(cats) as { id: string; name: string }[],
        tasks: (must(tasks) as { title: string; start_at: string; duration_min: number; category_id: string | null; priority: number; completed_at: string | null }[]).map(
          ({ completed_at, ...t }) => ({ ...t, done: !!completed_at }),
        ),
        events: must(events) as DayContext['events'],
      }
    },
    async profile() {
      return (must(await sb.from('planner_ai_profile').select('*').maybeSingle()) as ProfileRow | null) ?? null
    },
    async countPlansSince(_userId, sinceId) {
      const { count, error } = await sb.from('planner_ai_plans').select('id', { count: 'exact', head: true }).gte('id', sinceId)
      if (error) throw missing(error) ? new PlannerUnavailable(error.message) : new Error(error.message)
      return count ?? 0
    },
    async getPlan(_userId, id) {
      return (must(await sb.from('planner_ai_plans').select('*').eq('id', id).maybeSingle()) as PlanRow | null) ?? null
    },
    async upsertPlan(row) {
      const { user_id: _u, ...rest } = row // user_id defaults to auth.uid(); RLS checks it
      return must(await sb.from('planner_ai_plans').upsert(rest, { onConflict: 'id' }).select('*').single()) as PlanRow
    },
    async upsertProfile(row) {
      const { user_id: _u, ...rest } = row
      must(await sb.from('planner_ai_profile').upsert(rest, { onConflict: 'id' }))
    },
    async create(body): Promise<ModelMessage> {
      const fallback = FALLBACK_MODELS.has(String(body.model))
      try {
        // the handler builds the body as plain JSON (runtime-neutral, shared with the fakes); the SDK validates it on the wire
        const params = (fallback ? { ...body, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : body) as unknown as Parameters<typeof anthropic.beta.messages.create>[0]
        return (await anthropic.beta.messages.create(params)) as unknown as ModelMessage
      } catch (e) {
        if (e instanceof Anthropic.APIError) throw new ModelError(e.status ?? 0, e.message)
        throw new ModelError(0, (e as Error).name) // timeout / connection
      }
    },
  }
}

Deno.serve((req) => handlePlan(req, ports(req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '')))
