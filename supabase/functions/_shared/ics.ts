// ICS → event instances inside [from, to), with RRULE / RDATE / EXDATE / RECURRENCE-ID overrides expanded by ical.js.
import ICAL from 'ical.js'

export interface EventInstance {
  uid: string // `${UID}` for single events, `${UID}#${instanceStartISO}` for recurrence instances (unique per account)
  title: string
  location: string | null
  start_at: string // ISO UTC
  end_at: string
  all_day: boolean
  status: string | null
}

function toIso(t: ICAL.Time): string {
  // all-day (DATE) values are floating local dates; keep them at local midnight of that date
  return t.isDate ? new Date(t.year, t.month - 1, t.day).toISOString() : t.toJSDate().toISOString()
}

export function parseIcs(ics: string, from: Date, to: Date): EventInstance[] {
  const comp = new ICAL.Component(ICAL.parse(ics))
  // register VTIMEZONEs so TZID times resolve
  for (const tz of comp.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(new ICAL.Timezone(tz))
  const vevents = comp.getAllSubcomponents('vevent')
  const masters = vevents.filter((v) => !v.hasProperty('recurrence-id'))
  const overrides = vevents.filter((v) => v.hasProperty('recurrence-id'))
  const out: EventInstance[] = []
  for (const vm of masters) {
    const ev = new ICAL.Event(vm)
    for (const o of overrides) if (o.getFirstPropertyValue('uid') === ev.uid) ev.relateException(new ICAL.Event(o))
    const status = (vm.getFirstPropertyValue('status') as string | null) ?? null
    if (status === 'CANCELLED') continue
    const base = { title: ev.summary ?? '', location: ev.location || null, status }
    if (!ev.isRecurring()) {
      const s = ev.startDate.toJSDate()
      const e = (ev.endDate ?? ev.startDate).toJSDate()
      if (e > from && s < to) out.push({ uid: ev.uid, ...base, start_at: toIso(ev.startDate), end_at: toIso(ev.endDate ?? ev.startDate), all_day: ev.startDate.isDate })
      continue
    }
    const it = ev.iterator()
    for (let next = it.next(), guard = 0; next && guard < 2000; next = it.next(), guard++) {
      const d = ev.getOccurrenceDetails(next)
      const s = d.startDate.toJSDate()
      if (s >= to) break
      if (d.endDate.toJSDate() <= from) continue
      const item = d.item
      if ((item.component.getFirstPropertyValue('status') as string | null) === 'CANCELLED') continue
      out.push({
        uid: `${ev.uid}#${toIso(d.recurrenceId)}`,
        title: item.summary ?? base.title,
        location: item.location || base.location,
        status: base.status,
        start_at: toIso(d.startDate),
        end_at: toIso(d.endDate),
        all_day: d.startDate.isDate,
      })
    }
  }
  return out
}
