// Hermetic iCloud-shaped CalDAV server as a `fetch` function: PROPFIND principal → calendar-home-set (on a partition
// host, like iCloud) → calendars (one VEVENT, one VTODO-only), REPORT calendar-query returning fixture ICS: a single
// event, a daily recurring event with an EXDATE and a moved instance (RECURRENCE-ID), and an all-day event.
// Runs in Node (vitest, the Playwright fake) and Deno (deno test). Pure TS, no imports.

export const FAKE_USER = 'mark@icloud.example'
export const FAKE_PASSWORD = 'qvtz-hmwk-rpxa-ndjc'
export const PARTITION = 'https://p42-caldav.icloud.example'

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
/** Floating-free UTC stamp for local wall-clock h:m on day d. */
const at = (d: Date, h: number, m = 0) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m)
  return x.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

export interface FakeCalDavState {
  requests: { method: string; url: string; auth: string | null; body: string }[]
  /** extra objects per calendar (tests add / remove to exercise sync + tombstones) */
  extra: { href: string; etag: string; ics: string }[]
  removeDentist: boolean
}

export function fixtureIcs(today = new Date()): { href: string; etag: string; ics: string }[] {
  const t = today
  const cal = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//optimo test//EN\r\n${body}END:VCALENDAR\r\n`
  return [
    {
      href: '/1234/calendars/home/dentist.ics',
      etag: '"e-dentist-1"',
      ics: cal(`BEGIN:VEVENT\r\nUID:dentist-1\r\nDTSTAMP:${at(t, 0)}\r\nDTSTART:${at(t, 10, 30)}\r\nDTEND:${at(t, 11, 15)}\r\nSUMMARY:Dentist check-up\r\nLOCATION:Harbour St Dental\r\nEND:VEVENT\r\n`),
    },
    {
      href: '/1234/calendars/home/school-run.ics',
      etag: '"e-school-3"',
      ics: cal(
        `BEGIN:VEVENT\r\nUID:school-run\r\nDTSTAMP:${at(t, 0)}\r\nDTSTART:${at(addDays(t, -3), 8, 0)}\r\nDTEND:${at(addDays(t, -3), 8, 30)}\r\nRRULE:FREQ=DAILY;COUNT=10\r\nEXDATE:${at(addDays(t, 2), 8, 0)}\r\nSUMMARY:School run\r\nEND:VEVENT\r\n` +
          `BEGIN:VEVENT\r\nUID:school-run\r\nDTSTAMP:${at(t, 0)}\r\nRECURRENCE-ID:${at(addDays(t, 1), 8, 0)}\r\nDTSTART:${at(addDays(t, 1), 9, 0)}\r\nDTEND:${at(addDays(t, 1), 9, 30)}\r\nSUMMARY:School run (late start)\r\nEND:VEVENT\r\n`,
      ),
    },
    {
      href: '/1234/calendars/home/holiday.ics',
      etag: '"e-holiday-1"',
      ics: cal(`BEGIN:VEVENT\r\nUID:holiday\r\nDTSTAMP:${at(t, 0)}\r\nDTSTART;VALUE=DATE:${ymd(addDays(t, 3))}\r\nDTEND;VALUE=DATE:${ymd(addDays(t, 4))}\r\nSUMMARY:Public holiday\r\nEND:VEVENT\r\n`),
    },
  ]
}

const ms = (body: string) => `<?xml version="1.0" encoding="UTF-8"?>\n<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav" xmlns:ical="http://apple.com/ns/ical/">${body}</d:multistatus>`
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function fakeCalDav(state: FakeCalDavState = { requests: [], extra: [], removeDentist: false }, today = new Date()) {
  const good = `Basic ${btoa(`${FAKE_USER}:${FAKE_PASSWORD.replace(/-/g, '')}`)}`
  const good2 = `Basic ${btoa(`${FAKE_USER}:${FAKE_PASSWORD}`)}`
  const fetch = async (url: string, init: RequestInit = {}): Promise<Response> => {
    const method = (init.method ?? 'GET').toUpperCase()
    const headers = new Headers(init.headers)
    const auth = headers.get('authorization')
    const body = typeof init.body === 'string' ? init.body : ''
    state.requests.push({ method, url, auth, body })
    if (auth !== good && auth !== good2) return new Response('unauthorized', { status: 401 })
    const u = new URL(url)
    const xml = (s: string) => new Response(ms(s), { status: 207, headers: { 'content-type': 'application/xml' } })
    if (method === 'PROPFIND' && u.pathname === '/' && body.includes('current-user-principal'))
      return xml(`<d:response><d:href>/</d:href><d:propstat><d:prop><d:current-user-principal><d:href>/1234/principal/</d:href></d:current-user-principal></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`)
    if (method === 'PROPFIND' && u.pathname === '/1234/principal/')
      return xml(`<d:response><d:href>/1234/principal/</d:href><d:propstat><d:prop><cal:calendar-home-set><d:href>${PARTITION}/1234/calendars/</d:href></cal:calendar-home-set></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`)
    if (method === 'PROPFIND' && u.pathname === '/1234/calendars/')
      return xml(
        `<d:response><d:href>/1234/calendars/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>` +
          `<d:response><d:href>/1234/calendars/home/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/><cal:calendar/></d:resourcetype><d:displayname>Home</d:displayname><ical:calendar-color>#5B8DEFFF</ical:calendar-color><cal:supported-calendar-component-set><cal:comp name="VEVENT"/></cal:supported-calendar-component-set></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>` +
          `<d:response><d:href>/1234/calendars/reminders/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/><cal:calendar/></d:resourcetype><d:displayname>Reminders</d:displayname><cal:supported-calendar-component-set><cal:comp name="VTODO"/></cal:supported-calendar-component-set></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`,
      )
    if (method === 'REPORT' && u.pathname === '/1234/calendars/home/') {
      const objs = [...fixtureIcs(today).filter((o) => !(state.removeDentist && o.href.includes('dentist'))), ...state.extra]
      return xml(objs.map((o) => `<d:response><d:href>${o.href}</d:href><d:propstat><d:prop><d:getetag>${o.etag}</d:getetag><cal:calendar-data>${esc(o.ics)}</cal:calendar-data></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`).join(''))
    }
    return new Response('not in fake', { status: 404 })
  }
  return { fetch, state }
}
