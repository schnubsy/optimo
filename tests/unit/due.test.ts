import { describe, expect, it } from 'vitest'
import { dueReminders, localDate, payload, sentKey, zoned, type DueException, type DueTask } from '../../supabase/functions/_shared/due.ts'
import { handlePushSend, type PushPorts, type PushSub } from '../../supabase/functions/_shared/push.ts'

const NY = 'America/New_York'
const at = (y: number, m: number, d: number, h: number, mi = 0, tz = NY) => zoned(y, m, d, h, mi, tz)
const task = (p: Partial<DueTask>): DueTask => ({ id: 't1', title: 'Standup', start_at: null, reminders: [10], completed_at: null, deleted_at: null, rrule: null, dtstart: null, ...p })
const none = new Set<string>()
const NOW = at(2026, 9, 28, 8, 50) // Mon 28 Sep 2026, 08:50 New York

describe('dueReminders', () => {
  it('plain task: a 10-min reminder fires in its minute', () => {
    const d = dueReminders([task({ start_at: at(2026, 9, 28, 9).toISOString() })], [], none, NOW, NY)
    expect(d).toHaveLength(1)
    expect(d[0]).toMatchObject({ task_id: 't1', occurrence_date: '2026-09-28', minutes_before: 10 })
  })
  it('not before its minute, not after it', () => {
    const t = task({ start_at: at(2026, 9, 28, 9).toISOString() })
    // window = [now, now + 60 s): the run a minute early misses it, the run 59 s early catches it, a later run doesn't
    expect(dueReminders([t], [], none, new Date(NOW.getTime() - 60_000), NY)).toHaveLength(0)
    expect(dueReminders([t], [], none, new Date(NOW.getTime() - 59_000), NY)).toHaveLength(1)
    expect(dueReminders([t], [], none, new Date(NOW.getTime() + 1000), NY)).toHaveLength(0)
  })
  it('an at-start reminder (0) fires at the start', () => {
    expect(dueReminders([task({ start_at: at(2026, 9, 28, 8, 50).toISOString(), reminders: [0] })], [], none, NOW, NY)).toHaveLength(1)
  })
  it('several lead times: only the one in the window', () => {
    const d = dueReminders([task({ start_at: at(2026, 9, 28, 9).toISOString(), reminders: [0, 10, 30] })], [], none, NOW, NY)
    expect(d.map((x) => x.minutes_before)).toEqual([10])
  })
  it('completed, deleted and reminder-less tasks never fire', () => {
    const s = at(2026, 9, 28, 9).toISOString()
    expect(dueReminders([task({ start_at: s, completed_at: s }), task({ id: 't2', start_at: s, deleted_at: s }), task({ id: 't3', start_at: s, reminders: [] })], [], none, NOW, NY)).toEqual([])
  })
  it('already sent → skipped', () => {
    const t = task({ start_at: at(2026, 9, 28, 9).toISOString() })
    expect(dueReminders([t], [], new Set([sentKey('t1', '2026-09-28', 10)]), NOW, NY)).toEqual([])
  })
  const series = task({ id: 's1', title: 'Stand-up', rrule: 'FREQ=DAILY', dtstart: at(2026, 9, 1, 9).toISOString(), start_at: at(2026, 9, 1, 9).toISOString() })
  it('series: today’s occurrence fires 10 min before its 09:00', () => {
    const d = dueReminders([series], [], none, NOW, NY)
    expect(d).toHaveLength(1)
    expect(d[0]).toMatchObject({ task_id: 's1', occurrence_date: '2026-09-28' })
    expect(d[0].start.toISOString()).toBe(at(2026, 9, 28, 9).toISOString())
  })
  it('series: a skipped occurrence stays quiet', () => {
    const ex: DueException[] = [{ series_id: 's1', occurrence_date: '2026-09-28', task_id: null, skipped: true, deleted_at: null }]
    expect(dueReminders([series], ex, none, NOW, NY)).toEqual([])
  })
  it('series: a moved occurrence fires from its override row at the new time, not the series time', () => {
    const ex: DueException[] = [{ series_id: 's1', occurrence_date: '2026-09-28', task_id: 'o1', skipped: false, deleted_at: null }]
    const moved = task({ id: 'o1', title: 'Stand-up (moved)', start_at: at(2026, 9, 28, 9, 30).toISOString() })
    expect(dueReminders([series, moved], ex, none, NOW, NY)).toEqual([])
    const later = dueReminders([series, moved], ex, none, at(2026, 9, 28, 9, 20), NY)
    expect(later.map((d) => d.task_id)).toEqual(['o1'])
  })
  it('series: a completed occurrence (override with completed_at) stays quiet', () => {
    const ex: DueException[] = [{ series_id: 's1', occurrence_date: '2026-09-28', task_id: 'o2', skipped: false, deleted_at: null }]
    const done = task({ id: 'o2', start_at: at(2026, 9, 28, 9).toISOString(), completed_at: at(2026, 9, 28, 8).toISOString() })
    expect(dueReminders([series, done], ex, none, NOW, NY)).toEqual([])
  })
  it('series: floating time — 09:00 stays 09:00 local across the DST change', () => {
    const winter = task({ id: 's2', rrule: 'FREQ=WEEKLY;BYDAY=MO', dtstart: at(2026, 1, 5, 9).toISOString(), start_at: at(2026, 1, 5, 9).toISOString() })
    const d = dueReminders([winter], [], none, at(2026, 9, 28, 8, 50), NY)
    expect(d).toHaveLength(1)
    expect(d[0].start.toISOString()).toBe(at(2026, 9, 28, 9).toISOString()) // EDT now, EST at dtstart
  })
  it('series: an exception row that was itself deleted no longer suppresses the occurrence', () => {
    const ex: DueException[] = [{ series_id: 's1', occurrence_date: '2026-09-28', task_id: null, skipped: true, deleted_at: '2026-09-27T00:00:00Z' }]
    expect(dueReminders([series], ex, none, NOW, NY)).toHaveLength(1)
  })
  it('the occurrence date is the user’s local date, not UTC’s', () => {
    const AKL = 'Pacific/Auckland'
    const start = zoned(2026, 9, 29, 7, 0, AKL) // Tue 07:00 in Auckland = Mon evening UTC
    expect(localDate(start, AKL)).toBe('2026-09-29')
    const d = dueReminders([task({ start_at: start.toISOString() })], [], none, new Date(start.getTime() - 10 * 60_000), AKL)
    expect(d[0].occurrence_date).toBe('2026-09-29')
  })
  it('payload: title, "in 10 min · 09:00", tag and a link to the day', () => {
    const [d] = dueReminders([task({ start_at: at(2026, 9, 28, 9).toISOString() })], [], none, NOW, NY)
    expect(payload(d, NY)).toEqual({ title: 'Standup', body: 'in 10 min · 09:00', tag: 't1', url: '/optimo/?date=2026-09-28' })
    expect(payload({ ...d, minutes_before: 0 }, NY, false).body).toBe('now · 9:00 AM')
  })
})

describe('push-send handler', () => {
  function ports(statuses: Record<string, number>) {
    const subs: PushSub[] = [
      { endpoint: 'https://push.example/a', user_id: 'u1', p256dh: 'k', auth: 'a' },
      { endpoint: 'https://push.example/gone', user_id: 'u1', p256dh: 'k', auth: 'a' },
    ]
    const sent: string[] = []
    const marked: string[] = []
    const p: PushPorts = {
      cronSecret: 'c',
      subscriptions: async () => subs,
      userData: async () => ({ tasks: [task({ start_at: at(2026, 9, 28, 9).toISOString() })], exceptions: [], tz: NY, clock24: true }),
      sentKeys: async () => new Set(marked),
      markSent: async (rows) => void marked.push(...rows.map((r) => sentKey(r.task_id, r.occurrence_date, r.minutes_before))),
      send: async (s, body) => (sent.push(`${s.endpoint} ${body}`), statuses[s.endpoint] ?? 201),
      removeSubscription: async (e) => void subs.splice(subs.findIndex((s) => s.endpoint === e), 1),
    }
    return { p, subs, sent, marked }
  }
  const req = (secret?: string) => new Request('https://x/push-send', { method: 'POST', headers: secret ? { 'x-cron-secret': secret } : {} })
  it('needs the cron secret', async () => {
    expect((await handlePushSend(req('nope'), ports({}).p, NOW)).status).toBe(401)
    expect((await handlePushSend(req(), ports({}).p, NOW)).status).toBe(401)
  })
  it('sends to every live endpoint, prunes 410s, records the send once', async () => {
    const { p, subs, sent, marked } = ports({ 'https://push.example/gone': 410 })
    const r = await (await handlePushSend(req('c'), p, NOW)).json()
    expect(r).toEqual({ users: 1, sent: 1, pruned: 1 })
    expect(sent[0]).toContain('"body":"in 10 min · 09:00"')
    expect(subs.map((s) => s.endpoint)).toEqual(['https://push.example/a'])
    expect(marked).toEqual([sentKey('t1', '2026-09-28', 10)])
    // the next run in the same minute sends nothing again
    expect(await (await handlePushSend(req('c'), p, NOW)).json()).toEqual({ users: 1, sent: 0, pruned: 0 })
  })
})
