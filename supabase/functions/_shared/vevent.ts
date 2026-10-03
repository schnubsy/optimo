// optimo task ↔ iCloud VEVENT (arc 4, two-way). One task = one non-recurring VEVENT, UID `optimo-<task_id>@optimo`.
// Timed tasks are written in UTC; all-day tasks as DATE values in the user's zone. Reading back takes start, end and
// title only — everything else on the task (notes, category, subtasks, reminders, completion) stays optimo's.
import { localDate, zoned } from './due.ts'
import { parseIcs } from './ics.ts'

export interface PushTask {
  id: string
  title: string
  start_at: string // ISO
  duration_min: number
  all_day: boolean
}

export const OPTIMO_UID = /^optimo-([0-9a-f-]{36})@optimo$/i
export const uidFor = (taskId: string) => `optimo-${taskId}@optimo`
export const objectName = (taskId: string) => `optimo-${taskId}.ics`
/** The task id in an optimo UID, or null for any other event. */
export const taskIdOf = (uid: string) => OPTIMO_UID.exec(uid)?.[1]?.toLowerCase() ?? null

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const dateValue = (ymd: string) => ymd.replace(/-/g, '')
/** RFC 5545 TEXT escaping. */
const escText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
/** Fold content lines at 75 octets (continuation lines start with a space), never splitting a UTF-8 sequence. */
function fold(line: string): string {
  const enc = new TextEncoder()
  if (enc.encode(line).length <= 75) return line
  const out: string[] = []
  let cur = ''
  let size = 0
  for (const ch of line) {
    const n = enc.encode(ch).length
    if (size + n > (out.length ? 74 : 75)) {
      out.push(cur)
      cur = ''
      size = 0
    }
    cur += ch
    size += n
  }
  out.push(cur)
  return out.join('\r\n ')
}

/** The VCALENDAR optimo PUTs for a scheduled task. `tz` places all-day tasks on the user's local date. */
export function taskToIcs(t: PushTask, tz: string, now = new Date()): string {
  const start = new Date(t.start_at)
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//optimo//planner//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${uidFor(t.id)}`, `DTSTAMP:${stamp(now)}`]
  if (t.all_day) {
    const day = localDate(start, tz)
    const days = Math.max(1, Math.ceil((t.duration_min || 0) / 1440))
    const [y, m, d] = day.split('-').map(Number)
    const endDay = new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
    lines.push(`DTSTART;VALUE=DATE:${dateValue(day)}`, `DTEND;VALUE=DATE:${dateValue(endDay)}`)
  } else {
    lines.push(`DTSTART:${stamp(start)}`)
    // a zero-length task has no DTEND (RFC 5545: the event then ends when it starts)
    if (t.duration_min > 0) lines.push(`DTEND:${stamp(new Date(start.getTime() + t.duration_min * 60_000))}`)
  }
  lines.push(`SUMMARY:${escText(t.title || 'Untitled')}`, `X-OPTIMO-TASK-ID:${t.id}`, 'END:VEVENT', 'END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

export interface ICloudFields {
  title: string
  start_at: string
  duration_min: number
  all_day: boolean
}

/** What an optimo object in iCloud says now (after edits on an iPhone or Mac): start, length, title. */
export function icsToFields(ics: string, tz: string): ICloudFields | null {
  const [e] = parseIcs(ics, new Date(0), new Date(8.64e15))
  if (!e) return null
  if (e.all_day) {
    // parseIcs keeps DATE values at the runtime's local midnight; re-anchor that date at the user's local midnight
    const d = new Date(e.start_at)
    const ed = new Date(e.end_at)
    const days = Math.max(1, Math.round((ed.getTime() - d.getTime()) / 86_400_000))
    return { title: e.title, start_at: zoned(d.getFullYear(), d.getMonth() + 1, d.getDate(), 0, 0, tz).toISOString(), duration_min: days * 1440, all_day: true }
  }
  return { title: e.title, start_at: e.start_at, duration_min: Math.max(0, Math.round((Date.parse(e.end_at) - Date.parse(e.start_at)) / 60_000)), all_day: false }
}
