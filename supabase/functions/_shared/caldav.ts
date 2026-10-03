// Minimal CalDAV client for iCloud: principal → calendar-home-set → calendars → calendar-query / calendar-multiget
// REPORT, plus PUT / DELETE of optimo's own objects (arc 4, two-way) with If-Match / If-None-Match.
// Namespace-prefix-agnostic XML reading (iCloud mixes d:/D:/cal:/C: prefixes), no DOM — runs in Deno and Node.

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>

export interface DavCalendar {
  href: string
  name: string
  color: string | null
  enabled: boolean
  /** shared with or by this Apple ID (calendarserver `shared` / `shared-owner` resourcetype) */
  shared?: boolean
  /** the Apple ID may write objects into it (DAV current-user-privilege-set has write / write-content / all) */
  writable?: boolean
}
export interface DavObject {
  href: string
  etag: string | null
  ics: string
}

export class CalDavAuthError extends Error {}
/** 412 Precondition Failed: the object changed (or appeared) in iCloud since optimo last saw it. */
export class CalDavConflict extends Error {}

const unesc = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

/** Every element named `local` (any prefix), returning its inner XML. */
export function tags(xml: string, local: string): string[] {
  const re = new RegExp(`<(?:[\\w-]+:)?${local}\\b[^>]*?(?:/>|>([\\s\\S]*?)</(?:[\\w-]+:)?${local}>)`, 'g')
  return [...xml.matchAll(re)].map((m) => m[1] ?? '')
}
export const text = (xml: string, local: string): string | null => {
  const t = tags(xml, local)[0]
  return t === undefined ? null : unesc(t.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim())
}
/** Value of attribute `name` on every element named `local` — single- or double-quoted (iCloud writes `name='VEVENT'`). */
export function attrs(xml: string, local: string, name: string): string[] {
  const re = new RegExp(`<(?:[\\w-]+:)?${local}\\b[^>]*?\\s${name}\\s*=\\s*(['"])([\\s\\S]*?)\\1`, 'g')
  return [...xml.matchAll(re)].map((m) => unesc(m[2]))
}
/** Component names of a supported-calendar-component-set (e.g. ['VEVENT', 'VTODO']), uppercased. */
export const componentNames = (props: string): string[] => attrs(tags(props, 'supported-calendar-component-set')[0] ?? '', 'comp', 'name').map((n) => n.toUpperCase())
/** An empty or self-closing element named `local` is present (any prefix, any attributes). */
const has = (xml: string, local: string) => new RegExp(`<(?:[\\w-]+:)?${local}(?=[\\s/>])`).test(xml)

/** `<response>` blocks of a multistatus, with their href and the props of the 200 propstat only. */
export function responses(xml: string): { href: string; props: string }[] {
  return tags(xml, 'response').map((r) => {
    const ok = tags(r, 'propstat').filter((p) => /\b200\b/.test(text(p, 'status') ?? '200'))
    return { href: text(r, 'href') ?? '', props: ok.map((p) => tags(p, 'prop')[0] ?? '').join('') }
  })
}

export class CalDav {
  private base: string
  private auth: string // "Basic …"
  private fetchImpl: Fetch
  constructor(base: string, auth: string, fetchImpl: Fetch) {
    this.base = base
    this.auth = auth
    this.fetchImpl = fetchImpl
  }

  static basic(username: string, password: string) {
    return `Basic ${btoa(unescape(encodeURIComponent(`${username}:${password}`)))}`
  }

  /** Absolute URL of an href (paths resolve against the current host — the partition host after homeSet). */
  url(href: string) {
    return new URL(href, this.base).toString()
  }

  private async send(method: string, href: string, headers: Record<string, string>, body?: string): Promise<Response> {
    const res = await this.fetchImpl(this.url(href), { method, headers: { authorization: this.auth, ...headers }, body })
    if (res.status === 401) throw new CalDavAuthError('iCloud rejected the Apple ID or app-specific password')
    return res
  }

  private async dav(method: string, href: string, body: string, depth: string): Promise<string> {
    const res = await this.send(method, href, { depth, 'content-type': 'application/xml; charset=utf-8' }, body)
    if (res.status === 403) throw new CalDavAuthError('iCloud rejected the Apple ID or app-specific password')
    if (res.status !== 207 && !res.ok) throw new Error(`CalDAV ${method} ${res.status}`)
    return res.text()
  }

  async principal(): Promise<string> {
    const xml = await this.dav('PROPFIND', '/', '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>', '0')
    const p = tags(xml, 'current-user-principal')[0]
    const href = p ? text(p, 'href') : null
    if (!href) throw new Error('CalDAV: no current-user-principal')
    return this.url(href)
  }

  async homeSet(principal: string): Promise<string> {
    const xml = await this.dav('PROPFIND', principal, '<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-home-set/></d:prop></d:propfind>', '0')
    const h = tags(xml, 'calendar-home-set')[0]
    const href = h ? text(h, 'href') : null
    if (!href) throw new Error('CalDAV: no calendar-home-set')
    // iCloud answers with an absolute URL on a partition host (pXX-caldav.icloud.com); later requests go there
    this.base = new URL(href, this.base).origin
    return this.url(href)
  }

  async calendars(home: string): Promise<DavCalendar[]> {
    const xml = await this.dav(
      'PROPFIND',
      home,
      '<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:a="http://apple.com/ns/ical/"><d:prop><d:resourcetype/><d:displayname/><a:calendar-color/><c:supported-calendar-component-set/><d:current-user-privilege-set/></d:prop></d:propfind>',
      '1',
    )
    return responses(xml)
      .filter((r) => has(tags(r.props, 'resourcetype')[0] ?? '', 'calendar'))
      .filter((r) => {
        // no component set = the server's default (all components); otherwise it must list VEVENT
        const set = tags(r.props, 'supported-calendar-component-set')[0]
        return !set || componentNames(r.props).includes('VEVENT')
      })
      .map((r) => {
        const type = tags(r.props, 'resourcetype')[0] ?? ''
        const privs = tags(r.props, 'current-user-privilege-set')[0]
        return {
          href: this.url(r.href),
          name: text(r.props, 'displayname') || 'Calendar',
          color: (text(r.props, 'calendar-color') ?? '').slice(0, 7) || null,
          enabled: true,
          shared: has(type, 'shared') || has(type, 'shared-owner'),
          // no privilege set reported = assume the owner's full rights
          writable: privs === undefined || ['write', 'write-content', 'all'].some((p) => has(privs, p)),
        }
      })
  }

  /** calendar-query REPORT with a time-range; returns each object's ICS (calendar-data). */
  async events(calendarHref: string, from: Date, to: Date): Promise<DavObject[]> {
    const z = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const xml = await this.dav(
      'REPORT',
      calendarHref,
      `<?xml version="1.0"?><c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:getetag/><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range start="${z(from)}" end="${z(to)}"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>`,
      '1',
    )
    return responses(xml)
      .map((r) => ({ href: r.href, etag: text(r.props, 'getetag'), ics: text(r.props, 'calendar-data') ?? '' }))
      .filter((o) => o.ics.includes('BEGIN:VCALENDAR'))
  }

  /** calendar-multiget REPORT: the objects at `hrefs` (absolute or paths) in one calendar; `ics: null` = gone (404). */
  async multiget(calendarHref: string, hrefs: string[]): Promise<{ href: string; etag: string | null; ics: string | null }[]> {
    if (!hrefs.length) return []
    const path = (h: string) => new URL(h, this.base).pathname
    const xml = await this.dav(
      'REPORT',
      calendarHref,
      `<?xml version="1.0"?><c:calendar-multiget xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:getetag/><c:calendar-data/></d:prop>${hrefs.map((h) => `<d:href>${path(h)}</d:href>`).join('')}</c:calendar-multiget>`,
      '1',
    )
    const got = new Map(responses(xml).map((r) => [path(r.href), r]))
    return hrefs.map((h) => {
      const r = got.get(path(h))
      const ics = r ? text(r.props, 'calendar-data') : null
      return { href: this.url(h), etag: r ? text(r.props, 'getetag') : null, ics: ics && ics.includes('BEGIN:VCALENDAR') ? ics : null }
    })
  }

  /**
   * PUT an object. `etag` → If-Match (update exactly what optimo last wrote); `create` → If-None-Match: * (never
   * clobber an object that already exists). 412 → CalDavConflict. Returns the new etag when the server sends one.
   */
  async put(href: string, ics: string, cond: { etag?: string | null; create?: boolean } = {}): Promise<string | null> {
    const headers: Record<string, string> = { 'content-type': 'text/calendar; charset=utf-8' }
    if (cond.create) headers['if-none-match'] = '*'
    else if (cond.etag) headers['if-match'] = cond.etag
    const res = await this.send('PUT', href, headers, ics)
    if (res.status === 412) throw new CalDavConflict(`PUT ${res.status}`)
    if (!res.ok) throw new Error(`CalDAV PUT ${res.status}`)
    return res.headers.get('etag')
  }

  /** DELETE an object (If-Match when an etag is known). Already gone (404) is fine; 412 → CalDavConflict. */
  async remove(href: string, etag?: string | null): Promise<void> {
    const res = await this.send('DELETE', href, etag ? { 'if-match': etag } : {})
    if (res.status === 412) throw new CalDavConflict(`DELETE ${res.status}`)
    if (!res.ok && res.status !== 404) throw new Error(`CalDAV DELETE ${res.status}`)
  }
}
