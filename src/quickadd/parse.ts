// On-device quick-add grammar (docs/spec.md §2.4): chrono-node for date/time plus
//   `for 45m|1h|1h30|90 min` duration · `#category` · `!` `!!` `!!!` priority ·
//   `every day|weekday|week|month|<weekday>` recurrence · `@word` icon hint.
// Unparsed text becomes the title. No network, no LLM.

import * as chrono from 'chrono-node'
import type { Priority } from '../data/types'

export interface Parsed {
  title: string
  start: Date | null // null ⇒ inbox (unless dateOnly)
  dateOnly: boolean // a day was given without a time ⇒ all-day on that day
  duration: number | null
  category: string | null // the #token, unresolved
  priority: Priority
  rrule: string | null
  repeatLabel: string | null
  icon: string | null
}

const PART_OF_DAY = /^(morning|afternoon|evening|night)\b\s*/i
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
const DAY_ALT = WEEKDAYS.map((d) => `${d.slice(0, 3)}(?:${d.slice(3)})?`).join('|')

function takeRecurrence(text: string): { text: string; rrule: string | null; label: string | null; weekday: number | null } {
  const re = new RegExp(`\\bevery\\s+(day|weekday|week|month|other\\s+day|${DAY_ALT})s?\\b`, 'i')
  const m = text.match(re)
  if (!m) return { text, rrule: null, label: null, weekday: null }
  const what = m[1].toLowerCase()
  let rrule: string
  let label: string
  let weekday: number | null = null
  if (what === 'day') [rrule, label] = ['FREQ=DAILY', 'every day']
  else if (what === 'weekday') [rrule, label] = ['FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', 'every weekday']
  else if (what === 'week') [rrule, label] = ['FREQ=WEEKLY', 'every week']
  else if (what === 'month') [rrule, label] = ['FREQ=MONTHLY', 'every month']
  else if (/^other/.test(what)) [rrule, label] = ['FREQ=DAILY;INTERVAL=2', 'every other day']
  else {
    weekday = WEEKDAYS.findIndex((d) => d.startsWith(what.slice(0, 3)))
    ;[rrule, label] = [`FREQ=WEEKLY;BYDAY=${BYDAY[weekday]}`, `every ${WEEKDAYS[weekday][0].toUpperCase()}${WEEKDAYS[weekday].slice(1)}`]
  }
  return { text: text.replace(m[0], ' '), rrule, label, weekday }
}

function takeDuration(text: string): { text: string; duration: number | null } {
  // for 45m · for 1h · for 1h30 · for 1.5h · for 90 min · for 2 hours · for an hour · for half an hour
  const re = /\bfor\s+(?:(an?|half an|\d+(?:\.\d+)?)\s*(h(?:ours?|rs?)?|m(?:in(?:ute)?s?)?)?(?:\s*(\d{1,2})\s*(?:m(?:in(?:ute)?s?)?)?)?|(an?\s+hour|half\s+an\s+hour))\b/i
  const m = text.match(re)
  if (!m) return { text, duration: null }
  let minutes: number
  const phrase = (m[4] ?? m[1] ?? '').toLowerCase()
  if (/half an/.test(phrase)) minutes = 30
  else if (/^an?(\s+hour)?$/.test(phrase)) minutes = 60
  else {
    const n = parseFloat(m[1])
    const unit = (m[2] ?? '').toLowerCase()
    if (unit.startsWith('h')) minutes = Math.round(n * 60) + (m[3] ? parseInt(m[3], 10) : 0)
    else if (unit.startsWith('m')) minutes = Math.round(n)
    else minutes = n <= 12 ? Math.round(n * 60) : Math.round(n) // bare "for 2" ⇒ hours, "for 45" ⇒ minutes
  }
  return { text: text.replace(m[0], ' '), duration: minutes }
}

function takeTokens(text: string) {
  let category: string | null = null
  let icon: string | null = null
  let priority: Priority = 0
  text = text.replace(/(^|\s)#([\p{L}\p{N}_-]+)/u, (_, pre, c) => {
    category = c
    return pre
  })
  text = text.replace(/(^|\s)@([\p{L}\p{N}_-]+)/u, (_, pre, c) => {
    icon = c.toLowerCase()
    return pre
  })
  text = text.replace(/(^|\s)(!{1,3})(?=\s|$)/, (_, pre, bangs: string) => {
    priority = bangs.length as Priority
    return pre
  })
  return { text, category, icon, priority }
}

function tidyTitle(t: string): string {
  let s = t.replace(/\s+/g, ' ').trim()
  // drop dangling connectives left behind by removed date/duration phrases
  for (let i = 0; i < 3; i++) s = s.replace(/\s+(at|on|by|from|for|in|this|next|and|,)$/i, '').replace(/^(at|on|for)\s+/i, '').trim()
  return s ? s[0].toUpperCase() + s.slice(1) : s
}

export function parseQuickAdd(input: string, ref = new Date()): Parsed {
  let text = ` ${input} `
  const rec = takeRecurrence(text)
  text = rec.text
  const dur = takeDuration(text)
  text = dur.text
  const tok = takeTokens(text)
  text = tok.text

  let start: Date | null = null
  let dateOnly = false
  let duration = dur.duration
  const results = chrono.parse(text, ref, { forwardDate: true })
  // a bare part-of-day noun is part of the title ("Movie night", "Morning pages"), not a date — chrono reads it as
  // one; keep the word in the title and use only what follows it ("Movie night at 8pm" → "Movie night", 20:00)
  let keep = 0
  const r = results.find((res) => {
    const m = res.text.match(PART_OF_DAY)
    if (!m || /\b(this|tomorrow|tonight|in the|at|on|every)\s*$/i.test(text.slice(0, res.index))) return true
    if (res.text.trim().length === m[0].trim().length) return false
    keep = m[0].length
    return true
  })
  if (r) {
    const c = r.start
    const hasTime = c.isCertain('hour')
    const hasDay = c.isCertain('day') || c.isCertain('weekday') || c.isCertain('month')
    start = c.date()
    if (hasTime && !hasDay) {
      // a bare time means today, even if it has already passed (a planner logs the past too)
      start = new Date(ref)
      start.setHours(c.get('hour') ?? 0, c.get('minute') ?? 0, 0, 0)
    }
    if (!hasTime) {
      dateOnly = true
      start.setHours(0, 0, 0, 0)
    }
    if (r.end && hasTime && duration === null) duration = Math.max(0, Math.round((r.end.date().getTime() - c.date().getTime()) / 60000))
    text = text.slice(0, r.index + keep) + ' ' + text.slice(r.index + r.text.length)
  }
  // "every Monday" with no explicit date anchors on the next such weekday
  if (rec.weekday !== null && start && !r?.start.isCertain('weekday') && !r?.start.isCertain('day')) {
    const d = new Date(start)
    const diff = (rec.weekday - d.getDay() + 7) % 7
    d.setDate(d.getDate() + diff)
    start = d
  }
  if (rec.rrule && !start) {
    const d = new Date(ref)
    if (rec.weekday !== null) d.setDate(d.getDate() + ((rec.weekday - d.getDay() + 7) % 7))
    d.setHours(0, 0, 0, 0)
    start = d
    dateOnly = true
  }
  let rrule = rec.rrule
  if (rrule === 'FREQ=WEEKLY' && start) rrule = `FREQ=WEEKLY;BYDAY=${BYDAY[start.getDay()]}`
  if (rrule === 'FREQ=MONTHLY' && start) rrule = `FREQ=MONTHLY;BYMONTHDAY=${start.getDate()}`

  return {
    title: tidyTitle(text),
    start,
    dateOnly,
    duration,
    category: tok.category,
    priority: tok.priority,
    rrule,
    repeatLabel: rec.label,
    icon: tok.icon,
  }
}
