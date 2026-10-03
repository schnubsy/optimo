import { expect, type BrowserContext, type Page } from '@playwright/test'
import { FakeSupabase, trackErrors } from './fakeSupabase'

export const CAT = {
  work: '0190a000-0000-7000-8000-000000000001',
  meet: '0190a000-0000-7000-8000-000000000002',
  health: '0190a000-0000-7000-8000-000000000003',
  personal: '0190a000-0000-7000-8000-000000000004',
  family: '0190a000-0000-7000-8000-000000000005',
  errand: '0190a000-0000-7000-8000-000000000006',
  learn: '0190a000-0000-7000-8000-000000000007',
  home: '0190a000-0000-7000-8000-000000000008',
}

/** Local-time ISO for today (offset in days) at HH:MM — matches the browser's timezone (same machine). */
export function at(hhmm: string, dayOffset = 0): string {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

let n = 0
export const tid = () => `0190b000-0000-7000-8000-${String(++n).padStart(12, '0')}`

export function seedTask(server: FakeSupabase, t: Record<string, unknown>) {
  const row = { id: tid(), notes: '', priority: 0, duration_min: 30, deleted_at: null, subtasks: [], reminders: [], all_day: false, completed_at: null, sort_key: Date.now() + n, ...t }
  const field_ts: Record<string, number> = {}
  for (const k of Object.keys(row)) if (k !== 'id') field_ts[k] = 1
  server.upsert('planner_tasks', { ...row, field_ts })
  return row as { id: string } & Record<string, unknown>
}

/** A realistic day (titles are this project's own, from the Switchboard mock). */
export function seedDay(server: FakeSupabase) {
  const ids = {
    run: seedTask(server, { title: 'Morning run', start_at: at('07:00'), duration_min: 45, category_id: CAT.health, completed_at: at('07:50') }).id,
    deep: seedTask(server, { title: 'Deep work: quarterly forecast draft', start_at: at('09:00'), duration_min: 120, category_id: CAT.work, priority: 3 }).id,
    standup: seedTask(server, { title: 'Standup, platform team', start_at: at('11:00'), duration_min: 30, category_id: CAT.meet }).id,
    lunch: seedTask(server, { title: 'Lunch with Sam', start_at: at('13:00'), duration_min: 60, category_id: CAT.personal }).id,
    plan: seedTask(server, { title: 'Write the migration plan', start_at: at('14:00'), duration_min: 90, category_id: CAT.work, priority: 3, subtasks: [{ id: 's1', title: 'Outline', done: true }, { id: 's2', title: 'Rollback', done: false }] }).id,
    dentist: seedTask(server, { title: 'Call the dentist', start_at: at('15:30'), duration_min: 15, category_id: CAT.errand }).id,
    one: seedTask(server, { title: '1:1 with Dana', start_at: at('16:00'), duration_min: 30, category_id: CAT.meet }).id,
    overlap: seedTask(server, { title: 'Review pull request', start_at: at('16:15'), duration_min: 30, category_id: CAT.work }).id,
    pickup: seedTask(server, { title: 'Pick up Noah from practice', start_at: at('18:00'), duration_min: 30, category_id: CAT.family }).id,
    guitar: seedTask(server, { title: 'Guitar practice', start_at: at('19:30'), duration_min: 30, category_id: CAT.learn }).id,
  }
  const inbox = {
    flights: seedTask(server, { title: 'Book flights for October', start_at: null, duration_min: 30, category_id: CAT.personal, priority: 3 }).id,
    rego: seedTask(server, { title: 'Renew car registration', start_at: null, duration_min: 20, category_id: CAT.errand, priority: 1 }).id,
    ellen: seedTask(server, { title: 'Reply to Ellen re budget', start_at: null, duration_min: 15, category_id: CAT.work, priority: 2 }).id,
    ch4: seedTask(server, { title: 'Read chapter 4', start_at: null, duration_min: 45, category_id: CAT.learn }).id,
  }
  return { ids, inbox }
}

export async function openApp(page: Page, context: BrowserContext, opts: { seed?: (s: FakeSupabase) => void; theme?: 'dark' | 'light'; at?: string } = {}) {
  // `at: 'HH:MM'` pins today's clock (lessons 2026-10-02 [test]): late at night the timeline sits at "now" and
  // virtualises evening blocks away, so specs that reach for a 19:30 pill must not depend on the wall clock.
  if (opts.at) {
    const [h, m] = opts.at.split(':').map(Number)
    const now = new Date()
    now.setHours(h, m, 0, 0)
    await page.clock.install({ time: now })
  }
  const server = new FakeSupabase()
  opts.seed?.(server)
  await server.attach(context)
  if (opts.theme) await context.addInitScript((t) => localStorage.setItem('optimo.theme', t), opts.theme)
  const errors = trackErrors(page)
  await page.goto('./')
  await expect(page.getByTestId('sync-badge')).toHaveAttribute('data-state', 'synced')
  // default categories seed after the first sync; wait until they are pushed so every test starts quiet
  await expect.poll(() => page.evaluate(async () => {
    const o = (window as any).__optimo
    return (await o.db.categories.count()) >= 8 && (await o.db.outbox.count()) === 0
  })).toBe(true)
  if (opts.theme) {
    // the theme is a synced setting (planner_settings.data.theme); the localStorage copy only prevents a flash
    await page.evaluate((t) => (window as any).__optimo.repo.updateSettings({ theme: t }), opts.theme)
    await expect(page.locator('html')).toHaveAttribute('data-theme', opts.theme)
  }
  await expect(page.getByTestId('sync-badge')).toHaveAttribute('data-state', 'synced')
  return { server, errors }
}

export const row = (page: Page, id: string) => page.evaluate((i) => (window as any).__optimo.db.tasks.get(i), id)

/** The quick-add field: on iPhone it lives in the FAB's bottom sheet, so open that first. */
export async function quickAdd(page: Page) {
  const field = page.getByTestId('quickadd')
  if (!(await field.isVisible()) && (await page.getByTestId('fab').isVisible())) await page.getByTestId('fab').click()
  await expect(field).toBeVisible()
  return field
}
