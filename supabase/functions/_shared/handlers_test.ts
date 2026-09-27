// deno test — the calendar handlers in the real Edge runtime (Web Crypto, npm:ical.js via deno.json), against the
// same hermetic CalDAV fake and in-memory ports the vitest suite uses.
import { handleConnect, handleSync } from './handlers.ts'
import { decryptSecret, importKek } from './crypto.ts'
import { FAKE_PASSWORD, FAKE_USER, fakeCalDav } from '../../../tests/fake/caldav.ts'
import { MemPorts, TEST_KEK } from '../../../tests/fake/ports.ts'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}
const post = (body: unknown) =>
  new Request('https://x/f', { method: 'POST', headers: { authorization: 'Bearer jwt-mark', 'content-type': 'application/json' }, body: JSON.stringify(body) })

Deno.test('connect stores ciphertext only; sync expands the recurring fixture; resync is a no-op', async () => {
  const p = new MemPorts(fakeCalDav().fetch)
  const r = await handleConnect(post({ username: FAKE_USER, password: FAKE_PASSWORD }), p)
  assert(r.status === 200, `connect ${r.status}`)
  const acc = [...p.accountsById.values()][0]
  assert(!acc.secret_enc.includes(FAKE_PASSWORD), 'plaintext stored')
  assert((await decryptSecret(acc.secret_enc, await importKek(TEST_KEK))) === FAKE_PASSWORD, 'round trip')
  const s1 = await (await handleSync(post({}), p)).json()
  assert(s1.accounts[0].upserted === 11, `upserted ${s1.accounts[0].upserted}`)
  const s2 = await (await handleSync(post({}), p)).json()
  assert(s2.accounts[0].upserted === 0 && s2.accounts[0].removed === 0, 'resync not idempotent')
  assert(!p.logs.join(' ').includes(FAKE_PASSWORD), 'password in logs')
})

Deno.test('wrong password is a 401 with a plain message', async () => {
  const r = await handleConnect(post({ username: FAKE_USER, password: 'nope-nope-nope-nope' }), new MemPorts(fakeCalDav().fetch))
  assert(r.status === 401, `status ${r.status}`)
})

import { dueReminders, zoned } from './due.ts'
Deno.test('due: a daily 09:00 series fires at 08:50 local (npm:rrule in the Edge runtime)', () => {
  const tz = 'America/New_York'
  const s = zoned(2026, 9, 1, 9, 0, tz).toISOString()
  const d = dueReminders([{ id: 's', title: 'x', start_at: s, dtstart: s, rrule: 'FREQ=DAILY', reminders: [10], completed_at: null, deleted_at: null }], [], new Set(), zoned(2026, 9, 28, 8, 50, tz), tz)
  assert(d.length === 1 && d[0].occurrence_date === '2026-09-28', JSON.stringify(d))
})
