// deno test — two-way iCloud sync (arc 4) in the real Edge runtime, against the iCloud-shaped CalDAV fake.
import { handleConnect, handleSync } from './handlers.ts'
import { icsToFields } from './vevent.ts'
import { CAL, FAKE_PASSWORD, FAKE_USER, PARTITION, fakeCalDav } from '../../../tests/fake/caldav.ts'
import { MemPorts } from '../../../tests/fake/ports.ts'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}
const post = (body: unknown = {}) => new Request('https://x/f', { method: 'POST', headers: { authorization: 'Bearer jwt-mark' }, body: JSON.stringify(body) })
const TASK = '0190b000-0000-7000-8000-00000000b001'
const UID = `optimo-${TASK}@optimo`
const at = (h: number, day = 0) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + day)
  d.setUTCHours(h, 0, 0, 0)
  return d.toISOString()
}
async function setup() {
  const dav = fakeCalDav()
  const p = new MemPorts(dav.fetch)
  await handleConnect(post({ username: FAKE_USER, password: FAKE_PASSWORD }), p)
  const acc = [...p.accountsById.values()][0]
  const sync = async () => (await (await handleSync(post(), p)).json()).accounts[0]
  const puts = () => dav.state.requests.filter((r) => r.method === 'PUT').length
  return { dav, p, acc, sync, puts }
}

Deno.test('slice 4 push: create → update (If-Match) → move → delete; quiet when nothing changed', async () => {
  const { dav, p, acc, sync, puts } = await setup()
  p.clientWrite(TASK, { title: 'Swim', start_at: at(18), duration_min: 60 })
  let r = await sync()
  assert(r.twoWay.pushed === 1 && dav.objects(CAL.optimo).length === 1, JSON.stringify(r.twoWay))
  await sync()
  assert(puts() === 1, `re-pushed: ${puts()}`)
  p.clientWrite(TASK, { title: 'Swim (long)', duration_min: 90 })
  r = await sync()
  const f = icsToFields(dav.objects(CAL.optimo)[0].ics, 'UTC')!
  assert(r.twoWay.pushed === 1 && f.title === 'Swim (long)' && f.duration_min === 90, JSON.stringify(f))
  acc.write_calendar_href = `${PARTITION}${CAL.home}`
  r = await sync()
  assert(r.twoWay.moved === 1 && dav.objects(CAL.optimo).length === 0 && dav.objects(CAL.home).some((o) => o.ics.includes(UID)), 'move')
  p.clientWrite(TASK, { deleted_at: new Date().toISOString() })
  r = await sync()
  assert(r.twoWay.deleted === 1 && !dav.objects(CAL.home).some((o) => o.ics.includes(UID)) && p.calLinks.size === 0, 'delete')
})

Deno.test('slice 4 push: a 412 applies the iCloud edit instead of overwriting it', async () => {
  const { dav, p, sync } = await setup()
  p.clientWrite(TASK, { title: 'Forecast', start_at: at(9), duration_min: 60 })
  await sync()
  p.clientWrite(TASK, { title: 'Forecast (optimo)' })
  dav.state.beforePut = () => {
    dav.state.beforePut = undefined
    dav.editInICloud(CAL.optimo, UID, (ics) => ics.replace(/SUMMARY:.*/, 'SUMMARY:Forecast (iPhone)'))
  }
  const r = await sync()
  assert(r.twoWay.conflicts === 1, JSON.stringify(r.twoWay))
  assert(p.tasks.get(TASK)!.title === 'Forecast (iPhone)', p.tasks.get(TASK)!.title)
  assert(icsToFields(dav.objects(CAL.optimo)[0].ics, 'UTC')!.title === 'Forecast (iPhone)', 'overwritten')
})

Deno.test('slice 5 pull back: move → task moves; rename → title; delete → tombstoned; no ping-pong over 3 syncs', async () => {
  const { dav, p, sync, puts } = await setup()
  const z = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  p.clientWrite(TASK, { title: 'Prep', start_at: at(9), duration_min: 30 })
  await sync()
  dav.editInICloud(CAL.optimo, UID, (ics) => ics.replace(/^DTSTART:.*$/m, `DTSTART:${z(at(15))}`).replace(/^DTEND:.*$/m, `DTEND:${z(at(16))}`))
  await sync()
  let t = p.tasks.get(TASK)!
  assert(t.start_at === at(15) && t.duration_min === 60 && t.device_id === 'calendar-sync', JSON.stringify(t))
  dav.editInICloud(CAL.optimo, UID, (ics) => ics.replace(/SUMMARY:.*/, 'SUMMARY:Prep (forms)'))
  await sync()
  assert(p.tasks.get(TASK)!.title === 'Prep (forms)', 'rename')
  const n = puts()
  const v = p.tasks.get(TASK)!.version
  for (let i = 0; i < 3; i++) await sync()
  assert(puts() === n && p.tasks.get(TASK)!.version === v, `ping-pong: puts ${puts()} vs ${n}, version ${p.tasks.get(TASK)!.version} vs ${v}`)
  dav.deleteInICloud(CAL.optimo, UID)
  const r = await sync()
  t = p.tasks.get(TASK)!
  assert(r.twoWay.tombstoned === 1 && !!t.deleted_at && !p.calLinks.has(TASK), JSON.stringify(r.twoWay))
})

Deno.test('arc 5a slice 2: calendar-sync reports top-level events + pushed totals (accounts[] kept)', async () => {
  const { p } = await setup()
  p.clientWrite(TASK, { title: 'Swim', start_at: at(18), duration_min: 60 })
  p.clientWrite('0190b000-0000-7000-8000-00000000b002', { title: 'Read', start_at: at(20), duration_min: 30 })
  const r = await (await handleSync(post(), p)).json()
  const events = r.accounts.reduce((n: number, a: { events: number }) => n + a.events, 0)
  assert(r.pushed === 2 && r.accounts[0].twoWay.pushed === 2, JSON.stringify(r))
  assert(typeof r.events === 'number' && r.events === events && r.events > 0, JSON.stringify(r))
  const again = await (await handleSync(post(), p)).json()
  assert(again.pushed === 0 && again.events === r.events, JSON.stringify(again))
})
