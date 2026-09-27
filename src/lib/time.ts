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
