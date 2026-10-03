// arc 3 slice 11 — the AI tables on the device: Dexie v3 stores, outbox round-trip, field-level merge on pull, and the
// clean degrade while db/004_ai.sql isn't applied (pushes park; the core tables keep syncing).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OptimoDB, useDatabase, db } from '../../src/data/db'
import * as repo from '../../src/data/repo'
import { SyncEngine, applyRemote, fromRemote, isMissingTable, toRemote } from '../../src/sync/engine'
import type { AiPlan } from '../../src/data/types'

beforeEach(async () => {
  useDatabase(new OptimoDB(`t-${Math.random()}`))
  await db.open()
})

const serverPlan = (over: Partial<AiPlan> = {}): Record<string, unknown> => ({
  id: '0199a000-0000-7000-8000-000000000001',
  user_id: 'u1',
  plan_date: '2026-10-05',
  intent: 'Forecast, swim, email',
  mode: 'propose',
  status: 'draft',
  proposal: { blocks: [{ title: 'Focus', start_at: '2026-10-05T07:00:00+00:00', duration_min: 90, category_id: null, priority: 3, why: 'Fresh hours.' }], questions: [], notes: 'Tight day.' },
  research: [],
  model: 'claude-sonnet-5-5',
  accepted_task_ids: [],
  version: 1,
  updated_at: '2026-10-05T06:00:00+00:00',
  deleted_at: null,
  field_ts: { status: 100, proposal: 100, intent: 100 },
  device_id: 'plan-day',
  ...over,
})

describe('AI tables — local store + sync contract', () => {
  it('Dexie v3 has aiPlans (by plan_date) and aiProfile', async () => {
    expect(db.verno).toBeGreaterThanOrEqual(3)
    await applyRemote('aiPlans', [serverPlan()])
    expect(await db.aiPlans.where('plan_date').equals('2026-10-05').count()).toBe(1)
    const row = await db.aiPlans.get('0199a000-0000-7000-8000-000000000001')
    expect(row).toMatchObject({ status: 'draft', plan_date: '2026-10-05' })
    expect((row as unknown as { user_id?: string }).user_id).toBeUndefined()
  })

  it('a local accept round-trips through the outbox and survives a stale server echo (field-level LWW)', async () => {
    await applyRemote('aiPlans', [serverPlan()])
    await repo.updateAiPlan('0199a000-0000-7000-8000-000000000001', { status: 'accepted', accepted_task_ids: ['t1'] })
    const out = await db.outbox.toArray()
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ table: 'aiPlans', id: '0199a000-0000-7000-8000-000000000001' })
    const wire = toRemote('aiPlans', out[0].payload)
    expect(wire).toMatchObject({ status: 'accepted', accepted_task_ids: ['t1'] })
    expect(wire.version).toBeUndefined()
    // the server re-sends its older draft (status ts 100): the local accept (newer ts) must win
    await applyRemote('aiPlans', [serverPlan()])
    expect((await db.aiPlans.get('0199a000-0000-7000-8000-000000000001'))!.status).toBe('accepted')
    // a newer server proposal (re-plan) replaces the proposal but keeps the local status
    await applyRemote('aiPlans', [serverPlan({ proposal: { blocks: [], questions: ['Q?'], notes: '' }, field_ts: { status: 100, proposal: Date.now() + 10_000 } })])
    const merged = (await db.aiPlans.get('0199a000-0000-7000-8000-000000000001'))!
    expect(merged.status).toBe('accepted')
    expect(merged.proposal.questions).toEqual(['Q?'])
  })

  it('profile: pulled from the server, Reset tombstones it through the outbox', async () => {
    await applyRemote('aiProfile', [{ id: 'p1', user_id: 'u1', data: { tone: 'direct' }, accepted_count: 3, version: 2, deleted_at: null, field_ts: { data: 50, accepted_count: 50 }, device_id: 'plan-day' }])
    expect((await db.aiProfile.toArray())[0]).toMatchObject({ accepted_count: 3, data: { tone: 'direct' } })
    await repo.resetAiProfile()
    const p = (await db.aiProfile.get('p1'))!
    expect(p.deleted_at).not.toBeNull()
    expect(p.field_ts.deleted_at).toBeGreaterThan(50)
    expect((await db.outbox.toArray())[0]).toMatchObject({ table: 'aiProfile', id: 'p1' })
  })

  it('fromRemote keeps plan_date a calendar date and numbers numeric', () => {
    const r = fromRemote('aiPlans', serverPlan({ version: '7' as unknown as number }))
    expect(r.plan_date).toBe('2026-10-05')
    expect(r.version).toBe(7)
  })

  it('recognises PostgREST "table not there yet" answers', () => {
    expect(isMissingTable({ code: 'PGRST205', message: "Could not find the table 'public.planner_ai_plans' in the schema cache" })).toBe(true)
    expect(isMissingTable({ code: '42P01', message: 'relation "planner_ai_plans" does not exist' })).toBe(true)
    expect(isMissingTable({ code: '23505', message: 'duplicate key' })).toBe(false)
    expect(isMissingTable(null)).toBe(false)
  })

  it('degrade: AI pushes park while the tables are missing; tasks still push; nothing counts as pending', async () => {
    const t = await repo.createTask({ title: 'Real task' })
    await applyRemote('aiPlans', [serverPlan()])
    await repo.updateAiPlan('0199a000-0000-7000-8000-000000000001', { status: 'rejected' })
    const pushed: string[] = []
    const sb = {
      from: (table: string) => ({
        upsert: async () => {
          if (table.startsWith('planner_ai_')) return { error: { code: 'PGRST205', message: `Could not find the table 'public.${table}'` } }
          pushed.push(table)
          return { error: null }
        },
      }),
    }
    const engine = new SyncEngine(sb as never, 'u1')
    await engine.push()
    expect(pushed).toEqual(['planner_tasks'])
    const left = await db.outbox.toArray()
    expect(left.map((e) => e.table)).toEqual(['aiPlans'])
    expect(engine.parked.has('aiPlans')).toBe(true)
    expect(await (engine as unknown as { pendingCount(): Promise<number> }).pendingCount()).toBe(0)
    // once 004 is applied the parked row goes up on the next push
    sb.from = (table: string) => ({ upsert: async () => (pushed.push(table), { error: null }) })
    await engine.push()
    expect(pushed).toContain('planner_ai_plans')
    expect(await db.outbox.count()).toBe(0)
    expect(engine.parked.size).toBe(0)
    void t
    vi.restoreAllMocks()
  })
})

describe('Settings → Planning summary', () => {
  it('says what was learned in plain words, leaving empty fields out', async () => {
    const { learnedLines } = await import('../../src/plan/PlanningSettings')
    expect(learnedLines({ day_shape: 'deep work first', preferred_block_min: 75, habits: ['walk'], avoid: [] })).toEqual([
      'Day shape: deep work first',
      'Focus blocks: about 75 min',
      'Habits: walk',
    ])
    expect(learnedLines({})).toEqual([])
  })
})
