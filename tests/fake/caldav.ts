// Hermetic iCloud-shaped CalDAV server as a `fetch` function. Every reply is shaped like a real iCloud reply
// (RULE, arc 4): single-quoted attributes, default namespaces (`xmlns='DAV:'`) mixed with `D:` / `C:` / `cal:` /
// `ICAL:` prefixes, the calendar home on a partition host. A double-quote-only fixture is what hid the arc-4 bug.
// PROPFIND principal → calendar-home-set → the home listing: own "Home" (VEVENT, fixture events), own "optimo" (empty,
// the write target), a shared read-only "Family" calendar, a VTODO-only Reminders list, and the scheduling inbox /
// outbox / notification collections (none of which are event calendars). It is a small stateful object store:
// REPORT calendar-query / calendar-multiget, PUT (If-Match / If-None-Match: *), DELETE (If-Match) — enough for
// optimo's two-way sync. Runs in Node (vitest, the Playwright fake) and Deno (deno test). Pure TS, no imports.

export const FAKE_USER = 'mark@icloud.example'
export const FAKE_PASSWORD = 'qvtz-hmwk-rpxa-ndjc'
export const PARTITION = 'https://p42-caldav.icloud.example'
export const HOME = '/1234/calendars/'
export const CAL = { home: `${HOME}home/`, optimo: `${HOME}optimo-cal/`, family: `${HOME}family-shared/` } as const

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
/** Floating-free UTC stamp for local wall-clock h:m on day d. */
const at = (d: Date, h: number, m = 0) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m)
  return x.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

export interface DavObj {
  href: string
  etag: string
  ics: string
}
export interface FakeCalDavState {
  requests: { method: string; url: string; auth: string | null; body: string; headers?: Record<string, string> }[]
  /** extra objects in Home (tests add / remove to exercise sync + tombstones) */
  extra: DavObj[]
  removeDentist: boolean
  /** the home set lists no calendars at all (the "No calendars found" state) */
  emptyHome?: boolean
  /** the next PUT answers 412 (someone edited the object in iCloud between our read and our write) */
  failNextPut?: boolean
}

export function fixtureIcs(today = new Date()): DavObj[] {
  const t = today
  const cal = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//optimo test//EN\r\n${body}END:VCALENDAR\r\n`
  return [
    {
      href: `${CAL.home}dentist.ics`,
      etag: '"e-dentist-1"',
      ics: cal(`BEGIN:VEVENT\r\nUID:dentist-1\r\nDTSTAMP:${at(t, 0)}\r\nDTSTART:${at(t, 10, 30)}\r\nDTEND:${at(t, 11, 15)}\r\nSUMMARY:Dentist check-up\r\nLOCATION:Harbour St Dental\r\nEND:VEVENT\r\n`),
    },
    {
      href: `${CAL.home}school-run.ics`,
      etag: '"e-school-3"',
      ics: cal(
        `BEGIN:VEVENT\r\nUID:school-run\r\nDTSTAMP:${at(t, 0)}\r\nDTSTART:${at(addDays(t, -3), 8, 0)}\r\nDTEND:${at(addDays(t, -3), 8, 30)}\r\nRRULE:FREQ=DAILY;COUNT=10\r\nEXDATE:${at(addDays(t, 2), 8, 0)}\r\nSUMMARY:School run\r\nEND:VEVENT\r\n` +
          `BEGIN:VEVENT\r\nUID:school-run\r\nDTSTAMP:${at(t, 0)}\r\nRECURRENCE-ID:${at(addDays(t, 1), 8, 0)}\r\nDTSTART:${at(addDays(t, 1), 9, 0)}\r\nDTEND:${at(addDays(t, 1), 9, 30)}\r\nSUMMARY:School run (late start)\r\nEND:VEVENT\r\n`,
      ),
    },
    {
      href: `${CAL.home}holiday.ics`,
      etag: '"e-holiday-1"',
      ics: cal(`BEGIN:VEVENT\r\nUID:holiday\r\nDTSTAMP:${at(t, 0)}\r\nDTSTART;VALUE=DATE:${ymd(addDays(t, 3))}\r\nDTEND;VALUE=DATE:${ymd(addDays(t, 4))}\r\nSUMMARY:Public holiday\r\nEND:VEVENT\r\n`),
    },
  ]
}

/** The shared family calendar's one event (another family member's Apple ID owns it). */
export function familyIcs(today = new Date()): DavObj[] {
  const t = addDays(today, 2)
  return [
    {
      href: `${CAL.family}grandma.ics`,
      etag: '"e-grandma-1"',
      ics: `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//optimo test//EN\r\nBEGIN:VEVENT\r\nUID:grandma-dinner\r\nDTSTAMP:${at(t, 0)}\r\nDTSTART:${at(t, 18, 0)}\r\nDTEND:${at(t, 20, 0)}\r\nSUMMARY:Grandma’s birthday dinner\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`,
    },
  ]
}

// iCloud's own shape: an unprefixed DAV: default namespace, per-element xmlns for CalDAV / Apple / calendarserver.
const ms = (body: string) => `<?xml version='1.0' encoding='UTF-8'?>\n<multistatus xmlns='DAV:'>${body}</multistatus>`
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const ok = (props: string) => `<propstat><prop>${props}</prop><status>HTTP/1.1 200 OK</status></propstat>`
const C = `xmlns='urn:ietf:params:xml:ns:caldav'`
const CS = `xmlns='http://calendarserver.org/ns/'`
const ICAL = `xmlns='http://apple.com/ns/ical/'`
const priv = (...ps: string[]) => `<current-user-privilege-set>${ps.map((p) => `<privilege><${p}/></privilege>`).join('')}</current-user-privilege-set>`
const OWNER = priv('read', 'write', 'write-properties', 'write-content', 'bind', 'unbind', 'read-current-user-privilege-set')

function homeListing() {
  const r = (href: string, props: string, missing = '') =>
    `<response><href>${href}</href>${ok(props)}${missing ? `<propstat><prop>${missing}</prop><status>HTTP/1.1 404 Not Found</status></propstat>` : ''}</response>`
  return (
    r(HOME, `<resourcetype><collection/></resourcetype>${OWNER}`, `<displayname/><calendar-color ${ICAL}/>`) +
    // own calendar, Apple's mixed style: default-namespaced <calendar>, a C: prefixed component set, single quotes
    r(
      CAL.home,
      `<resourcetype><collection/><calendar ${C}/></resourcetype><displayname>Home</displayname><calendar-color ${ICAL} symbolic-color='custom'>#5B8DEFFF</calendar-color><C:supported-calendar-component-set xmlns:C='urn:ietf:params:xml:ns:caldav'><C:comp name='VEVENT'/></C:supported-calendar-component-set>${OWNER}`,
    ) +
    r(
      CAL.optimo,
      `<resourcetype><collection/><calendar ${C}/></resourcetype><displayname>optimo</displayname><ICAL:calendar-color xmlns:ICAL='http://apple.com/ns/ical/' symbolic-color='green'>#3FA66BFF</ICAL:calendar-color><supported-calendar-component-set ${C}><comp name='VEVENT'/></supported-calendar-component-set>${OWNER}`,
    ) +
    // a calendar another Apple ID shares with Mark, read-only: cs:shared in the resourcetype, no write privilege
    r(
      CAL.family,
      `<resourcetype><collection/><calendar ${C}/><shared ${CS}/></resourcetype><displayname>Family</displayname><calendar-color ${ICAL}>#E0745AFF</calendar-color><supported-calendar-component-set ${C}><comp name='VEVENT'/><comp name='VTODO'/></supported-calendar-component-set>${priv('read', 'read-current-user-privilege-set')}`,
    ) +
    r(
      `${HOME}reminders/`,
      `<resourcetype><collection/><calendar ${C}/></resourcetype><displayname>Reminders</displayname><supported-calendar-component-set ${C}><comp name='VTODO'/></supported-calendar-component-set>${OWNER}`,
    ) +
    r(`${HOME}inbox/`, `<resourcetype><collection/><schedule-inbox ${C}/></resourcetype>${OWNER}`, `<displayname/>`) +
    r(`${HOME}outbox/`, `<resourcetype><collection/><schedule-outbox ${C}/></resourcetype>${OWNER}`, `<displayname/>`) +
    r(`${HOME}notification/`, `<resourcetype><collection/><notification ${CS}/></resourcetype>${OWNER}`, `<displayname/>`)
  )
}

const uidOf = (ics: string) => /^UID:(.*)$/m.exec(ics)?.[1]?.trim() ?? ''
/** First DTSTART as a Date (UTC stamp or DATE); null if unreadable. */
function dtstart(ics: string): Date | null {
  const m = /^DTSTART(?:;[^:]*)?:(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/m.exec(ics)
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m
  return h ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)) : new Date(+y, +mo - 1, +d)
}
const fromStamp = (z: string) => new Date(`${z.slice(0, 4)}-${z.slice(4, 6)}-${z.slice(6, 8)}T${z.slice(9, 11)}:${z.slice(11, 13)}:${z.slice(13, 15)}Z`)

export function fakeCalDav(state: FakeCalDavState = { requests: [], extra: [], removeDentist: false }, today = new Date()) {
  const good = `Basic ${btoa(`${FAKE_USER}:${FAKE_PASSWORD.replace(/-/g, '')}`)}`
  const good2 = `Basic ${btoa(`${FAKE_USER}:${FAKE_PASSWORD}`)}`
  /** objects PUT by clients (optimo) and edits made "in iCloud" by tests; Home's fixture objects are computed */
  const store = new Map<string, Map<string, DavObj>>([
    [CAL.optimo, new Map()],
    [CAL.family, new Map(familyIcs(today).map((o) => [o.href, o]))],
  ])
  let n = 0
  const nextEtag = () => `"e-${++n}-${Date.now().toString(36)}"`
  const homeObjects = () => [...fixtureIcs(today).filter((o) => !(state.removeDentist && o.href.includes('dentist'))), ...state.extra]
  const objectsOf = (cal: string): DavObj[] => (cal === CAL.home ? homeObjects() : [...(store.get(cal)?.values() ?? [])])

  const fetch = async (url: string, init: RequestInit = {}): Promise<Response> => {
    const method = (init.method ?? 'GET').toUpperCase()
    const headers = new Headers(init.headers)
    const auth = headers.get('authorization')
    const body = typeof init.body === 'string' ? init.body : ''
    state.requests.push({ method, url, auth, body, headers: Object.fromEntries(headers.entries()) })
    if (auth !== good && auth !== good2) return new Response('unauthorized', { status: 401 })
    const u = new URL(url)
    const path = decodeURIComponent(u.pathname)
    const xml = (s: string) => new Response(ms(s), { status: 207, headers: { 'content-type': 'text/xml; charset=UTF-8' } })
    const objResponse = (o: DavObj) => `<response><href>${o.href}</href>${ok(`<getetag>${o.etag}</getetag><calendar-data ${C}>${esc(o.ics)}</calendar-data>`)}</response>`

    if (method === 'PROPFIND' && path === '/' && body.includes('current-user-principal'))
      return xml(`<response><href>/</href>${ok(`<current-user-principal><href>/1234/principal/</href></current-user-principal>`)}</response>`)
    if (method === 'PROPFIND' && path === '/1234/principal/')
      return xml(`<response><href>/1234/principal/</href>${ok(`<calendar-home-set ${C}><href xmlns='DAV:'>${PARTITION}${HOME}</href></calendar-home-set>`)}</response>`)
    if (method === 'PROPFIND' && path === HOME) {
      if (state.emptyHome) return xml(`<response><href>${HOME}</href>${ok(`<resourcetype><collection/></resourcetype>`)}</response>`)
      return xml(homeListing())
    }
    const cal = [CAL.home, CAL.optimo, CAL.family, `${HOME}reminders/`].find((c) => path === c)
    if (method === 'REPORT' && cal) {
      if (body.includes('calendar-multiget')) {
        const hrefs = [...body.matchAll(/<(?:[\w-]+:)?href>([^<]+)<\/(?:[\w-]+:)?href>/g)].map((m) => new URL(m[1], url).pathname)
        const objs = objectsOf(cal)
        return xml(
          hrefs
            .map((h) => {
              const o = objs.find((x) => x.href === h)
              return o ? objResponse(o) : `<response><href>${h}</href><status>HTTP/1.1 404 Not Found</status></response>`
            })
            .join(''),
        )
      }
      // calendar-query with a time-range: optimo's own objects are filtered by DTSTART (so "outside the window" is real);
      // fixture objects (recurring, all-day) are always returned and parseIcs clips them
      const range = /start=['"](\d{8}T\d{6}Z)['"][^>]*end=['"](\d{8}T\d{6}Z)/.exec(body)
      const inRange = (o: DavObj) => {
        if (!range || !uidOf(o.ics).startsWith('optimo-')) return true
        const s = dtstart(o.ics)
        return !!s && s < fromStamp(range[2]) && s.getTime() + 86_400_000 > fromStamp(range[1]).getTime()
      }
      return xml(objectsOf(cal).filter(inRange).map(objResponse).join(''))
    }
    const parent = path.replace(/[^/]+$/, '')
    if ((method === 'PUT' || method === 'DELETE') && store.has(parent)) {
      if (parent === CAL.family) return new Response('forbidden', { status: 403 })
      const objs = store.get(parent)!
      const cur = objs.get(path)
      const ifMatch = headers.get('if-match')
      const ifNone = headers.get('if-none-match')
      if (method === 'DELETE') {
        if (!cur) return new Response('', { status: 404 })
        if (ifMatch && ifMatch !== cur.etag) return new Response('', { status: 412 })
        objs.delete(path)
        return new Response(null, { status: 204 })
      }
      if (state.failNextPut) {
        state.failNextPut = false
        return new Response('', { status: 412 })
      }
      if (ifNone === '*' && cur) return new Response('', { status: 412 })
      if (ifMatch && ifMatch !== cur?.etag) return new Response('', { status: 412 })
      const etag = nextEtag()
      objs.set(path, { href: path, etag, ics: body })
      return new Response(null, { status: cur ? 204 : 201, headers: { etag } })
    }
    return new Response('not in fake', { status: 404 })
  }

  /** Test helpers: what iCloud holds, and edits made "on the iPhone" (new etag, like iCloud). */
  const objects = (cal: string) => objectsOf(cal)
  const editInICloud = (cal: string, uid: string, edit: (ics: string) => string) => {
    const objs = store.get(cal)!
    const o = [...objs.values()].find((x) => uidOf(x.ics) === uid)
    if (!o) throw new Error(`no ${uid} in ${cal}`)
    objs.set(o.href, { ...o, ics: edit(o.ics), etag: nextEtag() })
  }
  const deleteInICloud = (cal: string, uid: string) => {
    const objs = store.get(cal)!
    for (const [k, o] of objs) if (uidOf(o.ics) === uid) objs.delete(k)
  }
  return { fetch, state, objects, editInICloud, deleteInICloud }
}
