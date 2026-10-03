import { describe, expect, it } from 'vitest'
import { CalDav, componentNames, responses, text } from '../../supabase/functions/_shared/caldav.ts'
import { decryptSecret, encryptSecret, importKek } from '../../supabase/functions/_shared/crypto.ts'
import { handleConnect, handleSync } from '../../supabase/functions/_shared/handlers.ts'
import { CAL, FAKE_PASSWORD, FAKE_USER, PARTITION, fakeCalDav } from '../fake/caldav'
import { MemPorts, TEST_CRON, TEST_KEK } from '../fake/ports'

const post = (body: unknown, headers: Record<string, string> = { authorization: 'Bearer jwt-mark' }) =>
  new Request('https://x/functions/v1/f', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })

describe('AES-GCM secret', () => {
  it('round-trips and never stores the plaintext', async () => {
    const key = await importKek(TEST_KEK)
    const enc = await encryptSecret(FAKE_PASSWORD, key)
    expect(enc).not.toContain(FAKE_PASSWORD)
    expect(atob(enc).length).toBe(12 + FAKE_PASSWORD.length + 16) // iv | ct | tag
    expect(await decryptSecret(enc, key)).toBe(FAKE_PASSWORD)
    expect(await encryptSecret(FAKE_PASSWORD, key)).not.toBe(enc) // fresh IV each time
  })
  it('rejects a short KEK and a tampered ciphertext', async () => {
    await expect(importKek(btoa('short'))).rejects.toThrow(/32 bytes/)
    const key = await importKek(TEST_KEK)
    const enc = await encryptSecret('x', key)
    const bad = btoa(atob(enc).slice(0, -1) + String.fromCharCode(atob(enc).charCodeAt(atob(enc).length - 1) ^ 1))
    await expect(decryptSecret(bad, key)).rejects.toBeTruthy()
  })
})

describe('CalDAV XML', () => {
  it('reads multistatus responses whatever the namespace prefix, 200 propstats only', () => {
    const xml = `<D:multistatus xmlns:D="DAV:"><D:response><D:href>/a/</D:href><D:propstat><D:prop><D:displayname>Work &amp; life</D:displayname></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat><D:propstat><D:prop><D:getetag/></D:prop><D:status>HTTP/1.1 404 Not Found</D:status></D:propstat></D:response></D:multistatus>`
    const [r] = responses(xml)
    expect(r.href).toBe('/a/')
    expect(text(r.props, 'displayname')).toBe('Work & life')
    expect(text(r.props, 'getetag')).toBeNull()
  })
  it('discovers principal → home (partition host) → VEVENT calendars only', async () => {
    const { fetch } = fakeCalDav()
    const dav = new CalDav('https://caldav.icloud.com/', CalDav.basic(FAKE_USER, FAKE_PASSWORD), fetch)
    const home = await dav.homeSet(await dav.principal())
    expect(home).toBe(`${PARTITION}/1234/calendars/`)
    const cals = await dav.calendars(home)
    expect(cals.map((c) => c.name)).toEqual(['Home', 'optimo', 'Family'])
    const objs = await dav.events(cals[0].href, new Date(), new Date(Date.now() + 86_400_000))
    expect(objs.map((o) => o.etag)).toContain('"e-dentist-1"')
  })
  it('arc 4 regression: an iCloud-shaped home listing (single-quoted attributes) keeps every event calendar', async () => {
    const { fetch } = fakeCalDav()
    const dav = new CalDav('https://caldav.icloud.com/', CalDav.basic(FAKE_USER, FAKE_PASSWORD), fetch)
    const cals = await dav.calendars(await dav.homeSet(await dav.principal()))
    // own Home + own optimo + the shared read-only Family calendar; never Reminders (VTODO), inbox, outbox, notification
    expect(cals).toEqual([
      { href: `${PARTITION}${CAL.home}`, name: 'Home', color: '#5B8DEF', enabled: true, shared: false, writable: true },
      { href: `${PARTITION}${CAL.optimo}`, name: 'optimo', color: '#3FA66B', enabled: true, shared: false, writable: true },
      { href: `${PARTITION}${CAL.family}`, name: 'Family', color: '#E0745A', enabled: true, shared: true, writable: false },
    ])
  })
  it('attribute reads accept single and double quotes alike', () => {
    for (const q of [`'`, `"`]) {
      const xml = `<multistatus xmlns=${q}DAV:${q}><response><href>/c/</href><propstat><prop><resourcetype><collection/><calendar xmlns=${q}urn:ietf:params:xml:ns:caldav${q}/></resourcetype><displayname>W</displayname><supported-calendar-component-set xmlns=${q}urn:ietf:params:xml:ns:caldav${q}><comp name=${q}VEVENT${q}/></supported-calendar-component-set></prop><status>HTTP/1.1 200 OK</status></propstat></response></multistatus>`
      expect(componentNames(responses(xml)[0].props)).toEqual(['VEVENT'])
    }
  })
})

describe('calendar-connect / calendar-sync handlers', () => {
  it('connect: wrong password → 401 plain message, nothing stored, password never logged', async () => {
    const p = new MemPorts(fakeCalDav().fetch)
    const r = await handleConnect(post({ username: FAKE_USER, password: 'wrong-pass-word-xxxx' }), p)
    expect(r.status).toBe(401)
    expect((await r.json()).error).toMatch(/didn’t accept/)
    expect(p.accountsById.size).toBe(0)
    expect(p.logs.join(' ')).not.toContain('wrong-pass')
  })
  it('connect: no JWT → 401', async () => {
    const r = await handleConnect(post({ username: FAKE_USER, password: FAKE_PASSWORD }, {}), new MemPorts(fakeCalDav().fetch))
    expect(r.status).toBe(401)
  })
  it('connect: discovers calendars, stores only ciphertext, returns the public row', async () => {
    const p = new MemPorts(fakeCalDav().fetch)
    const r = await handleConnect(post({ username: FAKE_USER, password: FAKE_PASSWORD, label: 'Family iCloud' }), p)
    expect(r.status).toBe(200)
    const body = await r.json()
    expect(body.secret_enc).toBeUndefined()
    expect(JSON.stringify(body)).not.toContain(FAKE_PASSWORD)
    expect(body.calendars).toHaveLength(3) // Home, optimo, the shared Family calendar
    const stored = [...p.accountsById.values()][0]
    expect(stored.secret_enc).not.toContain(FAKE_PASSWORD.slice(0, 4))
    expect(await decryptSecret(stored.secret_enc, await importKek(TEST_KEK))).toBe(FAKE_PASSWORD)
  })
  it('sync: upserts instances, is idempotent, tombstones vanished events, skips disabled calendars', async () => {
    const dav = fakeCalDav()
    const p = new MemPorts(dav.fetch)
    await handleConnect(post({ username: FAKE_USER, password: FAKE_PASSWORD }), p)
    let r = await (await handleSync(post({}), p)).json()
    expect(r.accounts[0].upserted).toBe(12) // dentist + 9 school runs + holiday + the shared calendar's dinner
    expect(p.live()).toHaveLength(12)
    expect(p.live().some((e) => e.title === 'Grandma’s birthday dinner')).toBe(true)
    r = await (await handleSync(post({}), p)).json()
    expect(r.accounts[0]).toMatchObject({ upserted: 0, removed: 0 })
    dav.state.removeDentist = true
    r = await (await handleSync(post({}), p)).json()
    expect(r.accounts[0]).toMatchObject({ upserted: 0, removed: 1 })
    expect(p.live().some((e) => e.title === 'Dentist check-up')).toBe(false)
    const acc = [...p.accountsById.values()][0]
    acc.calendars[0].enabled = false // Home off → only the shared calendar's event stays
    await handleSync(post({}), p)
    expect(p.live().map((e) => e.title)).toEqual(['Grandma’s birthday dinner'])
    expect(acc.last_sync_at).toBeTruthy()
  })
  it('sync via cron: needs the right x-cron-secret; records a readable last_error on auth failure', async () => {
    const p = new MemPorts(fakeCalDav().fetch)
    await handleConnect(post({ username: FAKE_USER, password: FAKE_PASSWORD }), p)
    expect((await handleSync(post({}, { 'x-cron-secret': 'nope' }), p)).status).toBe(401)
    const acc = [...p.accountsById.values()][0]
    acc.secret_enc = await encryptSecret('revoked-password', await importKek(TEST_KEK)) // Apple revoked it
    const r = await (await handleSync(post({}, { 'x-cron-secret': TEST_CRON }), p)).json()
    expect(r.accounts[0].error).toMatch(/reconnect in Settings/)
    expect(acc.last_error).toMatch(/reconnect/)
  })
})
