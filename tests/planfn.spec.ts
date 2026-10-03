// arc 3 slice 12 — plan-day through the hermetic server: the REAL handler (supabase/functions/_shared/plan.ts) runs
// in-process behind /functions/v1/plan-day with the scripted model (tests/fake/planPorts.ts). The browser calls it
// exactly as the app will (supabase-js functions.invoke carries the session JWT).
import { test, expect } from '@playwright/test'
import { at, openApp } from './support/app'

const invoke = (page: import('@playwright/test').Page, body: Record<string, unknown>, auth = true) =>
  page.evaluate(
    async ([b, withAuth]) => {
      const jwt = JSON.parse(localStorage.getItem('press:family:v1')!).access_token // the Family Wing session (arc 5a)
      const r = await fetch('https://eepjhpyziczrxvirczio.supabase.co/functions/v1/plan-day', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(withAuth ? { authorization: `Bearer ${jwt}` } : {}) },
        body: JSON.stringify(b),
      })
      return { status: r.status, body: await r.json() }
    },
    [body, auth] as const,
  )

test.describe('plan-day in the hermetic server', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'one engine is enough for the function contract')

  test('propose → a draft row in planner_ai_plans that syncs down; learn → profile; no JWT → 401', async ({ page, context }) => {
    const { server } = await openApp(page, context, {
      at: '08:00',
      seed: (s) => {
        s.ai = true
        s.planFn = true
      },
    })
    const day = await page.evaluate(() => {
      const d = new Date()
      return { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, from: new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString(), to: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString() }
    })
    const r = await invoke(page, { action: 'propose', ...day, tz: 'UTC', intent: 'Forecast, swim, email', mode: 'propose', research: false })
    expect(r.status).toBe(200)
    expect(r.body.status).toBe('draft')
    expect(r.body.proposal.blocks[0].start_at).toBe(at('09:00'))
    // the server row reaches the device through the sync log like any row
    await expect.poll(() => page.evaluate(async (id) => (await (window as any).__optimo.db.aiPlans.get(id))?.status, r.body.id)).toBe('draft')
    const l = await invoke(page, { action: 'learn', plan_id: r.body.id, accepted_task_ids: [], edits: [], rejected: [] })
    expect(l.status).toBe(200)
    expect([...server.rows.planner_ai_profile.values()][0]).toMatchObject({ accepted_count: 1 })
    expect((await invoke(page, { action: 'propose', ...day, intent: 'x' }, false)).status).toBe(401)
    expect(server.unexpected).toEqual([])
  })
})
