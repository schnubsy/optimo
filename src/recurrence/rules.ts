// The repeat choices the UI offers, as RFC 5545 RRULE strings (stored without DTSTART; dtstart is its own column).

export const REPEAT_OPTIONS = ['none', 'daily', 'weekday', 'weekly', 'monthly'] as const
export type Repeat = (typeof REPEAT_OPTIONS)[number] | 'custom'

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

export function repeatToRule(r: string, date: Date): string | null {
  switch (r) {
    case 'daily':
      return 'FREQ=DAILY'
    case 'weekday':
      return 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'
    case 'weekly':
      return `FREQ=WEEKLY;BYDAY=${BYDAY[date.getDay()]}`
    case 'monthly':
      return `FREQ=MONTHLY;BYMONTHDAY=${date.getDate()}`
    default:
      return null
  }
}

export function ruleToRepeat(rule: string | null): Repeat {
  if (!rule) return 'none'
  const r = rule.replace(/^RRULE:/, '').split(';').filter((p) => !p.startsWith('UNTIL=') && !p.startsWith('COUNT=')).join(';')
  if (r === 'FREQ=DAILY') return 'daily'
  if (r === 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR') return 'weekday'
  if (/^FREQ=WEEKLY;BYDAY=[A-Z]{2}$/.test(r)) return 'weekly'
  if (/^FREQ=MONTHLY;BYMONTHDAY=\d+$/.test(r)) return 'monthly'
  return 'custom'
}

export function repeatLabel(r: string): string {
  return { none: 'Does not repeat', daily: 'Every day', weekday: 'Every weekday', weekly: 'Every week', monthly: 'Every month', custom: 'Custom' }[r] ?? r
}
