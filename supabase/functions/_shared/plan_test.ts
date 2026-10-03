// deno test — plan-day in the real Edge runtime against the scripted model (tests/fake/planPorts.ts), the same fake
// vitest and the hermetic Playwright server drive.
import { DAILY_LIMIT, LEARN_MODEL, handlePlan, uuidv7Floor } from './plan.ts'
import { FAKE_SOURCE, FakeModel, MemPlanPorts, PLAN_USER } from '../../../tests/fake/planPorts.ts'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}
const post = (body: unknown, jwt = 'jwt-mark') =>
  new Request('https://x/plan-day', { method: 'POST', headers: { authorization: `Bearer ${jwt}`, 'content-type': 'application/json' }, body: JSON.stringify(body) })
// Europe/Berlin, CEST: local midnight of 2026-10-05 is 22:00Z the day before
const DAY = { date: '2026-10-05', from: '2026-10-04T22:00:00.000Z', to: '2026-10-05T22:00:00.000Z', tz: 'Europe/Berlin' }
const INTENT = 'Finish the forecast draft, swim, clear email'
const propose = (extra: Record<string, unknown> = {}) => post({ action: 'propose', ...DAY, intent: INTENT, mode: 'propose', research: false, ...extra })

Deno.test('propose: a draft row with local times turned into UTC, the challenge notes, no research', async () => {
  const p = new MemPlanPorts()
  const r = await handlePlan(propose(), p)
  assert(r.status === 200, `status ${r.status}`)
  const row = await r.json()
  assert(row.status === 'draft' && row.mode === 'propose' && row.plan_date === DAY.date, JSON.stringify(row))
  assert(row.proposal.blocks.length === 3, 'three blocks')
  assert(row.proposal.blocks[0].start_at === '2026-10-05T07:00:00.000Z', `09:00 Berlin → ${row.proposal.blocks[0].start_at}`)
  assert(row.proposal.blocks[0].category_id === '0190a000-0000-7000-8000-000000000001', 'category id kept')
  assert(row.proposal.blocks.every((b: { why: string }) => b.why.length > 0), 'every block has a why')
  assert(/more than the free time/.test(row.proposal.notes), 'challenge notes')
  assert(row.research.length === 0, 'no research')
  assert(row.field_ts.proposal > 0 && row.device_id === 'plan-day', 'sync cols stamped')
  const call = p.fake.calls[0]
  assert(call.model === 'claude-sonnet-5-5', 'default model')
  assert((call.tool_choice as { type: string }).type === 'auto', 'auto tool choice (forced is a 400 on current models)')
  assert(!(call.tools as { type?: string }[]).some((t) => t.type?.startsWith('web_search')), 'no web search when off')
  const text = JSON.stringify(call.messages)
  assert(text.includes('Standup') && text.includes('13:00'), 'the fixed task is in the context, in local time')
  assert(!/device|notes_body|password/i.test(text), 'nothing beyond planning data')
})

Deno.test('propose with research: resumes over pause_turn and returns cited sources', async () => {
  const p = new MemPlanPorts()
  const r = await handlePlan(propose({ research: true }), p)
  assert(r.status === 200, `status ${r.status}`)
  const row = await r.json()
  assert(p.fake.calls.length === 2, `calls ${p.fake.calls.length}`)
  const ws = (p.fake.calls[0].tools as { type?: string; max_uses?: number }[]).find((t) => t.type === 'web_search_20260209')
  assert(ws?.max_uses === 3, 'web search, max 3 uses')
  assert(p.fake.calls[1].messages.length === 2 && p.fake.calls[1].messages[1].role === 'assistant', 'paused turn re-sent, no extra user message')
  assert(row.research.length === 1 && row.research[0].url === FAKE_SOURCE.url, JSON.stringify(row.research))
  assert(row.research[0].snippet === FAKE_SOURCE.cited && row.research[0].query === 'Harbour Pool opening hours', 'snippet + query')
})

Deno.test('the 31st plan of the day is a 429 with a friendly message; re-planning an existing plan is not counted', async () => {
  const p = new MemPlanPorts()
  for (let i = 0; i < DAILY_LIMIT; i++) {
    const r = await handlePlan(propose(), p)
    assert(r.status === 200, `plan ${i} ${r.status}`)
  }
  const over = await handlePlan(propose(), p)
  assert(over.status === 429, `status ${over.status}`)
  assert(/30 plans today/.test((await over.json()).error), 'friendly')
  const id = [...p.plans.keys()][0]
  const again = await handlePlan(propose({ plan_id: id, answers: [{ question: 'Movable?', answer: 'yes' }] }), p)
  assert(again.status === 200, 're-plan allowed')
  assert(uuidv7Floor(new Date('2026-10-05T00:00:00Z')) <= id, 'ids sort after the day floor')
})

Deno.test('malformed model output is a 502 and stores nothing', async () => {
  const p = new MemPlanPorts()
  const r = await handlePlan(propose({ intent: 'whatever #malformed' }), p)
  assert(r.status === 502, `status ${r.status}`)
  assert(p.plans.size === 0, 'nothing stored')
})

Deno.test('a plain-text answer gets one nudge, then the tool call lands', async () => {
  const p = new MemPlanPorts(new FakeModel({ textFirst: true }))
  const r = await handlePlan(propose(), p)
  assert(r.status === 200, `status ${r.status}`)
  assert(p.fake.calls.length === 2, 'nudged once')
})

Deno.test('one retry on 529/timeout; a 400 is not retried; the intent never reaches the log', async () => {
  const ok = new MemPlanPorts(new FakeModel({ failWith: { status: 529, times: 1 } }))
  assert((await handlePlan(propose(), ok)).status === 200, 'retried once')
  const busy = new MemPlanPorts(new FakeModel({ failWith: { status: 529, times: 2 } }))
  assert((await handlePlan(propose(), busy)).status === 503, 'busy after the retry')
  const bad = new MemPlanPorts(new FakeModel({ failWith: { status: 400, times: 1 } }))
  assert((await handlePlan(propose(), bad)).status === 502, '400 → 502')
  assert(bad.fake.calls.length === 1, 'no retry on 400')
  assert(![...busy.logs, ...bad.logs].join(' ').includes('forecast'), 'intent logged')
})

Deno.test('learn distils into the profile with the small model and bumps accepted_count', async () => {
  const p = new MemPlanPorts()
  const plan = await (await handlePlan(propose(), p)).json()
  const r = await handlePlan(post({ action: 'learn', plan_id: plan.id, accepted_task_ids: ['t1', 't2'], edits: [{ before: plan.proposal.blocks[0], after: { ...plan.proposal.blocks[0], duration_min: 75 } }], rejected: [plan.proposal.blocks[2]] }), p)
  assert(r.status === 200, `status ${r.status}`)
  const prof = p.profiles.get(PLAN_USER)!
  assert(prof.accepted_count === 1 && prof.data.preferred_block_min === 75, JSON.stringify(prof))
  const call = p.fake.calls.at(-1)!
  assert(call.model === LEARN_MODEL, 'haiku for the distil')
  assert(String(call.messages[0].content).includes('"duration_min":75'), 'the edit is in the diff')
  await handlePlan(post({ action: 'learn', plan_id: plan.id, accepted_task_ids: ['t1'] }), p)
  assert(p.profiles.get(PLAN_USER)!.accepted_count === 2, 'bumped')
  // after a Reset (tombstone) learning starts a fresh profile on the same row
  p.profiles.get(PLAN_USER)!.deleted_at = '2026-10-05T08:00:00.000Z'
  await handlePlan(post({ action: 'learn', plan_id: plan.id, accepted_task_ids: [] }), p)
  const fresh = p.profiles.get(PLAN_USER)!
  assert(fresh.accepted_count === 1 && fresh.deleted_at === null && fresh.id === prof.id, JSON.stringify(fresh))
})

Deno.test('no JWT is a 401; bad input is a 400', async () => {
  const p = new MemPlanPorts()
  assert((await handlePlan(propose(), new MemPlanPorts())).status === 200, 'baseline')
  assert((await handlePlan(post({ action: 'propose', ...DAY, intent: INTENT }, 'nope'), p)).status === 401, '401')
  assert((await handlePlan(post({ action: 'propose', ...DAY, intent: '' }), p)).status === 400, 'empty intent')
  assert((await handlePlan(post({ action: 'learn', plan_id: 'missing' }), p)).status === 404, 'unknown plan')
})

Deno.test('missing planner tables are a 503 not_connected, not a crash', async () => {
  const { PlannerUnavailable } = await import('./plan.ts')
  const p = new MemPlanPorts()
  p.countPlansSince = () => Promise.reject(new PlannerUnavailable('relation "planner_ai_plans" does not exist'))
  const r = await handlePlan(propose(), p)
  assert(r.status === 503 && (await r.json()).code === 'not_connected', `status ${r.status}`)
})
