// arc 4 — two-way iCloud sync (slices 4 + 5) against the stateful iCloud-shaped CalDAV fake and in-memory ports.
import { describe, expect, it } from 'vitest'
import { handleConnect, handleSync } from '../../supabase/functions/_shared/handlers.ts'
import { icsToFields, taskToIcs } from '../../supabase/functions/_shared/vevent.ts'
import { CAL, FAKE_PASSWORD, FAKE_USER, PARTITION, fakeCalDav } from '../fake/caldav'
import { MemPorts } from '../fake/ports'

const post = () => new Request('https://x/functions/v1/f', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer jwt-mark' }, body: '{}' })
const TASK = '0190b000-0000-7000-8000-00000000a001'
const TASK2 = '0190b000-0000-7000-8000-00000000a002'
const UID = `optimo-${TASK}@optimo`
const hour = (h: number, dayOffset = 0) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + dayOffset)
  d.setUTCHours(h, 0, 0, 0)
  return d.toISOString()
}

async function setup() {
  const dav = fakeCalDav()
  const p = new MemPorts(dav.fetch)
  await handleConnect(new Request('https://x/f', { method: 'POST', headers: { authorization: 'Bearer jwt-mark' }, body: JSON.stringify({ username: FAKE_USER, password: FAKE_PASSWORD }) }), p)
  const acc = [...p.accountsById.values()][0]
  const sync = async () => (await (await handleSync(post(), p)).json()).accounts[0]
  const puts = () => dav.state.requests.filter((r) => r.method === 'PUT')
  const inOptimo = () => dav.objects(CAL.optimo)
  return { dav, p, acc, sync, puts, inOptimo }
}

describe('slice 4 — push: optimo → iCloud', () => {
  it('writes a timed task into the chosen calendar (If-None-Match: *), links it, and stays quiet after', async () => {
    const { p, acc, sync, puts, inOptimo } = await setup()
    expect(acc.write_calendar_href).toBe(`${PARTITION}${CAL.optimo}`)
    p.clientWrite(TASK, { title: 'Write the migration plan', start_at: hour(14), duration_min: 90 })
    const r = await sync()
    expect(r.twoWay).toMatchObject({ pushed: 1, deleted: 0, conflicts: 0 })
    expect(r.events).toBe(12) // optimo's own object is never cached as an event
    const [obj] = inOptimo()
    expect(obj.href).toBe(`${CAL.optimo}optimo-${TASK}.ics`)
    expect(obj.ics).toContain(`UID:${UID}`)
    expect(obj.ics).toContain(`X-OPTIMO-TASK-ID:${TASK}`)
    expect(icsToFields(obj.ics, 'UTC')).toEqual({ title: 'Write the migration plan', start_at: hour(14), duration_min: 90, all_day: false })
    expect(puts()[0].headers?.['if-none-match']).toBe('*')
    const link = p.calLinks.get(TASK)!
    expect(link).toMatchObject({ uid: UID, etag: obj.etag, pushed_version: p.tasks.get(TASK)!.version })
    expect(p.live().some((e) => e.uid === UID)).toBe(false)
    for (let i = 0; i < 3; i++) await sync()
    expect(puts()).toHaveLength(1) // no re-push while nothing changed
  })

  it('an edit in optimo updates the object with If-Match on the etag optimo last wrote', async () => {
    const { p, sync, puts, inOptimo } = await setup()
    p.clientWrite(TASK, { title: 'Draft', start_at: hour(9), duration_min: 30 })
    await sync()
    const etag = inOptimo()[0].etag
    p.clientWrite(TASK, { title: 'Draft v2', start_at: hour(10), duration_min: 45 })
    expect((await sync()).twoWay.pushed).toBe(1)
    expect(puts()[1].headers?.['if-match']).toBe(etag)
    expect(icsToFields(inOptimo()[0].ics, 'UTC')).toMatchObject({ title: 'Draft v2', start_at: hour(10), duration_min: 45 })
  })

  it('completed tasks keep their event; unscheduled or deleted tasks lose it', async () => {
    const { p, sync, inOptimo } = await setup()
    p.clientWrite(TASK, { title: 'Run', start_at: hour(7), duration_min: 45 })
    p.clientWrite(TASK2, { title: 'Call Dana', start_at: hour(16), duration_min: 30 })
    await sync()
    expect(inOptimo()).toHaveLength(2)
    p.clientWrite(TASK, { completed_at: hour(8) } as never)
    await sync()
    expect(inOptimo()).toHaveLength(2)
    p.clientWrite(TASK, { start_at: null }) // back to the inbox
    let r = await sync()
    expect(r.twoWay.deleted).toBe(1)
    expect(inOptimo().map((o) => o.href)).toEqual([`${CAL.optimo}optimo-${TASK2}.ics`])
    expect(p.calLinks.has(TASK)).toBe(false)
    p.clientWrite(TASK2, { deleted_at: new Date().toISOString() })
    r = await sync()
    expect(r.twoWay.deleted).toBe(1)
    expect(inOptimo()).toHaveLength(0)
    expect(p.calLinks.size).toBe(0)
  })

  it('changing the write target moves every object (DELETE old, PUT new)', async () => {
    const { dav, p, acc, sync, inOptimo } = await setup()
    p.clientWrite(TASK, { title: 'Swim', start_at: hour(18), duration_min: 60 })
    await sync()
    acc.write_calendar_href = `${PARTITION}${CAL.home}` // Mark picks Home in Settings
    const r = await sync()
    expect(r.twoWay).toMatchObject({ moved: 1, pushed: 1 })
    expect(inOptimo()).toHaveLength(0)
    expect(dav.objects(CAL.home).filter((o) => o.ics.includes(UID))).toHaveLength(1)
    expect(p.calLinks.get(TASK)!.calendar_href).toBe(`${PARTITION}${CAL.home}`)
    expect(r.events).toBe(12) // still not cached as an event in Home
  })

  it('412 on PUT: the iCloud edit wins and is applied to the task, never overwritten — then no ping-pong', async () => {
    const { dav, p, sync, puts, inOptimo } = await setup()
    p.clientWrite(TASK, { title: 'Forecast', start_at: hour(9), duration_min: 60 })
    await sync()
    p.clientWrite(TASK, { title: 'Forecast (optimo edit)' })
    // between optimo's read and its write, Mark renames it on his iPhone
    dav.state.beforePut = () => {
      dav.state.beforePut = undefined
      dav.editInICloud(CAL.optimo, UID, (ics) => ics.replace(/SUMMARY:.*/, 'SUMMARY:Forecast (iPhone edit)'))
    }
    const r = await sync()
    expect(r.twoWay.conflicts).toBe(1)
    expect(icsToFields(inOptimo()[0].ics, 'UTC')!.title).toBe('Forecast (iPhone edit)')
    expect(p.tasks.get(TASK)!.title).toBe('Forecast (iPhone edit)')
    expect(p.tasks.get(TASK)!.device_id).toBe('calendar-sync')
    const n = puts().length
    for (let i = 0; i < 3; i++) await sync()
    expect(puts()).toHaveLength(n)
  })

  it('never writes recurring series, override rows, tasks older than the window, or anything with write-back off', async () => {
    const { p, acc, sync, puts } = await setup()
    p.clientWrite(TASK, { title: 'Standup', start_at: hour(9), rrule: 'FREQ=DAILY' })
    p.clientWrite(TASK2, { title: 'Old', start_at: hour(9, -10) })
    p.clientWrite('0190b000-0000-7000-8000-00000000a003', { title: 'Override', start_at: hour(9), series_id: TASK })
    await sync()
    expect(puts()).toHaveLength(0)
    acc.write_calendar_href = null
    p.clientWrite('0190b000-0000-7000-8000-00000000a004', { title: 'New', start_at: hour(11) })
    expect((await sync()).twoWay.pushed).toBe(0)
    expect(puts()).toHaveLength(0)
  })

  it('a task that ages out of the window keeps its event', async () => {
    const { p, sync, inOptimo } = await setup()
    p.clientWrite(TASK, { title: 'Trip', start_at: hour(9), duration_min: 60 })
    await sync()
    p.clientWrite(TASK, { start_at: hour(9, -12) }) // moved to 12 days ago
    const r = await sync()
    expect(r.twoWay.deleted).toBe(0)
    expect(inOptimo()).toHaveLength(1)
  })
})

describe('VEVENT shape', () => {
  it('all-day tasks are DATE events on the user’s local day; text is escaped and folded at 75 octets', () => {
    const tz = 'America/Chicago'
    const ics = taskToIcs({ id: TASK, title: 'Holiday; pack, labels\\ and a very long title — with ünïcödé so the line folds past seventy-five octets', start_at: '2026-10-05T05:00:00.000Z', duration_min: 30, all_day: true }, tz)
    expect(ics).toContain('DTSTART;VALUE=DATE:20261005')
    expect(ics).toContain('DTEND;VALUE=DATE:20261006')
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    const back = icsToFields(ics, tz)!
    expect(back.title).toBe('Holiday; pack, labels\\ and a very long title — with ünïcödé so the line folds past seventy-five octets')
    expect(back).toMatchObject({ start_at: '2026-10-05T05:00:00.000Z', all_day: true })
  })
  it('a zero-length task has no DTEND', () => {
    const ics = taskToIcs({ id: TASK, title: 'Ping', start_at: '2026-10-05T14:00:00.000Z', duration_min: 0, all_day: false }, 'UTC')
    expect(ics).not.toContain('DTEND')
    expect(icsToFields(ics, 'UTC')).toMatchObject({ duration_min: 0 })
  })
})
