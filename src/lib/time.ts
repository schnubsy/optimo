const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const MIN_PER_DAY = 1440

/** "Fri 26 Sep 2026" — the status-strip date. */
export function formatDayTitle(d: Date): string {
  return `${WD[d.getDay()]} ${d.getDate()} ${MO[d.getMonth()]} ${d.getFullYear()}`
}
export const shortDay = (d: Date) => `${WD[d.getDay()]} ${d.getDate()}`
export const weekdayName = (d: Date) => WD[d.getDay()]
export const monthTitle = (d: Date) => `${MO[d.getMonth()]} ${d.getFullYear()}`

const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar day key, YYYY-MM-DD. */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const todayKey = () => dateKey(new Date())
export function addDays(key: string, n: number): string {
  const d = fromKey(key)
  d.setDate(d.getDate() + n)
  return dateKey(d)
}
/** ISO instant for a local day key + minutes after local midnight. */
export function isoAt(key: string, minutes: number): string {
  const d = fromKey(key)
  d.setMinutes(minutes)
  return d.toISOString()
}
/** [startIso, endIso) of a local day. */
export function dayRange(key: string): [string, string] {
  return [isoAt(key, 0), isoAt(addDays(key, 1), 0)]
}
/** Minutes after the local midnight of `key` for an ISO instant (can be <0 or >1440). */
export function minutesInDay(iso: string, key: string): number {
  return Math.round((new Date(iso).getTime() - fromKey(key).getTime()) / 60000)
}
export function nowMinutes(d = new Date()): number {
  return d.getHours() * 60 + d.getMinutes()
}

/** 13:05 / 1:05 PM */
export function fmtClock(min: number, clock24 = true): string {
  const m = ((Math.round(min) % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY
  const h = Math.floor(m / 60)
  const mm = pad(m % 60)
  if (clock24) return `${pad(h)}:${mm}`
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mm} ${h < 12 ? 'AM' : 'PM'}`
}
/** 1:30 */
export function fmtDur(min: number): string {
  const m = Math.max(0, Math.round(min))
  return `${Math.floor(m / 60)}:${pad(m % 60)}`
}
/** 7h25 */
export function fmtHours(min: number): string {
  const m = Math.max(0, Math.round(min))
  return `${Math.floor(m / 60)}h${pad(m % 60)}`
}
/** Monday/Sunday-start week containing `key`. */
export function weekStart(key: string, startsOn: 0 | 1): string {
  const d = fromKey(key)
  const diff = (d.getDay() - startsOn + 7) % 7
  return addDays(key, -diff)
}

// ---------- arc 6: spine copy formats (mockups 01 / 08) ----------

/** Gutter label: "9:00" / "10:30" (12 h, no meridiem) or "09:00" (24 h). */
export function fmtGutter(min: number, clock24 = true): string {
  return clock24 ? fmtClock(min, true) : fmtClock(min, false).replace(/ [AP]M$/, '')
}
/** "8:00–9:30 PM", "11:30 AM–12:30 PM", "20:00–21:30". */
export function fmtRange(start: number, end: number, clock24 = true): string {
  if (clock24) return `${fmtClock(start, true)}–${fmtClock(end, true)}`
  const a = fmtClock(start, false)
  const b = fmtClock(end, false)
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -3)}–${b}` : `${a}–${b}`
}
/** "1 hr, 30 min" / "15 min" / "2 hr". */
export function fmtDurWords(min: number): string {
  const m = Math.max(0, Math.round(min))
  const h = Math.floor(m / 60)
  const r = m % 60
  if (!h) return `${r} min`
  return r ? `${h} hr, ${r} min` : `${h} hr`
}
/** "13h 29m" / "1h" / "45m" — the free-time duration. */
export function fmtGap(min: number): string {
  const m = Math.max(0, Math.round(min))
  const h = Math.floor(m / 60)
  const r = m % 60
  return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m`
}

// ---------- arc 6 slice 7: per-task time zones (planner_tasks.tz, db/007) ----------

/** The device's IANA zone. */
export const deviceZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

const zoneFmt = new Map<string, Intl.DateTimeFormat>()
/** Offset of `tz` from UTC at instant `t`, in ms (positive east of Greenwich). */
export function tzOffset(t: number, tz: string): number {
  let f = zoneFmt.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    zoneFmt.set(tz, f)
  }
  const p = Object.fromEntries(f.formatToParts(new Date(t)).map((x) => [x.type, x.value]))
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute), Number(p.second))
  return asUtc - Math.floor(t / 1000) * 1000
}

/** ISO instant for a wall-clock day + minutes in `tz` (null/undefined = the device zone, i.e. isoAt). */
export function isoAtZone(key: string, minutes: number, tz?: string | null): string {
  if (!tz) return isoAt(key, minutes)
  const [y, m, d] = key.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d, 0, minutes)
  let t = guess - tzOffset(guess, tz)
  t = guess - tzOffset(t, tz) // second pass settles a DST edge
  return new Date(t).toISOString()
}

/** The wall-clock day + minutes of an instant in `tz` (null = the device zone). */
export function zonedParts(iso: string, tz?: string | null): { date: string; minutes: number } {
  const t = new Date(iso).getTime()
  if (!tz) {
    const d = new Date(t)
    return { date: dateKey(d), minutes: d.getHours() * 60 + d.getMinutes() }
  }
  const w = new Date(t + tzOffset(t, tz))
  return { date: `${w.getUTCFullYear()}-${pad(w.getUTCMonth() + 1)}-${pad(w.getUTCDate())}`, minutes: w.getUTCHours() * 60 + w.getUTCMinutes() }
}

/** "Europe/London" → "London", "America/Argentina/Buenos_Aires" → "Buenos Aires". */
export const zoneCity = (tz: string) => tz.split('/').pop()!.replace(/_/g, ' ')
