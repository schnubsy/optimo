// Same convergence proof against the REAL press project. Runs only when a gitignored .env.test.local provides
// a dedicated test user (OPTIMO_TEST_EMAIL / OPTIMO_TEST_PASSWORD); otherwise it is skipped and the evidence says so.
import { existsSync, readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { v7 } from 'uuid'

function env(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of ['.env.production', '.env.test.local'])
    if (existsSync(f))
      for (const line of readFileSync(f, 'utf8').split('\n')) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
        if (m) out[m[1]] = m[2].trim()
      }
  return out
}
const E = env()
const ready = Boolean(E.OPTIMO_TEST_EMAIL && E.OPTIMO_TEST_PASSWORD)

const row = (p: Page, id: string) => p.evaluate((i) => (window as any).__optimo.db.tasks.get(i), id)
const edit = (p: Page, id: string, patch: object) =>
  p.evaluate(([i, x]) => (window as any).__optimo.repo.updateTask(i, x), [id, patch] as const)

test('@real two devices converge through press', async ({ browser, baseURL }, info) => {
  test.skip(!ready, 'SKIPPED: no .env.test.local test user (hermetic sync.spec.ts is the gate)')
  test.skip(info.project.name !== 'desktop', 'runs once')
  const sb = createClient(E.VITE_SUPABASE_URL, E.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { data, error } = await sb.auth.signInWithPassword({ email: E.OPTIMO_TEST_EMAIL, password: E.OPTIMO_TEST_PASSWORD })
  expect(error).toBeNull()
  const session = data.session!
  const storageKey = `sb-${new URL(E.VITE_SUPABASE_URL).host.split('.')[0]}-auth-token`
  const id = v7()
  const now = Date.now()
  await sb.from('planner_tasks').upsert({ id, title: 'real-sync probe', notes: '', field_ts: { title: now, notes: now } })

  const ctxs = await Promise.all([browser.newContext({ baseURL }), browser.newContext({ baseURL })])
  for (const c of ctxs)
    await c.addInitScript(([k, s]) => {
      localStorage.setItem('optimo.test', '1')
      localStorage.setItem('optimo.pollMs', '1500')
      localStorage.setItem(k, JSON.stringify(s))
    }, [storageKey, session] as const)
  const [a, b] = await Promise.all(ctxs.map((c) => c.newPage()))
  await Promise.all([a.goto('./'), b.goto('./')])
  for (const p of [a, b]) await expect.poll(async () => (await row(p, id))?.title, { timeout: 10_000 }).toBe('real-sync probe')
  for (const c of ctxs) await c.setOffline(true)
  await edit(a, id, { title: 'real-sync probe v2' })
  await edit(b, id, { notes: 'from B' })
  for (const c of ctxs) await c.setOffline(false)
  for (const p of [a, b])
    await expect.poll(async () => { const r = await row(p, id); return r && `${r.title}/${r.notes}` }, { timeout: 5000 }).toBe('real-sync probe v2/from B')
  // tidy: tombstone the probe
  await edit(a, id, { deleted_at: new Date().toISOString() })
  await a.waitForTimeout(1000)
  await Promise.all(ctxs.map((c) => c.close()))
})
