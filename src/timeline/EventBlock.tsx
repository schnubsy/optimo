import { memo, useState } from 'react'
import { Icon } from '../icons/Icon'
import { fmtClock } from '../lib/time'
import type { EventItem } from '../calendar/events'
import { pillHeight } from './Block'

/**
 * A calendar event on the timeline: an outlined (not filled) pill with a small calendar chip, fixed in place
 * (not draggable or resizable); tap shows its details. Shares overlap columns with tasks.
 */
export const EventBlock = memo(function EventBlock({ item, col, cols, hourPx, clock24, calendarName }: { item: EventItem; col: number; cols: number; hourPx: number; clock24: boolean; calendarName?: string }) {
  const [open, setOpen] = useState(false)
  const e = item.event
  const height = pillHeight(item.end - item.start, hourPx)
  const thin = height < 44
  const time = `${fmtClock(item.start, clock24)}–${fmtClock(item.end, clock24)}`
  const gap = 4
  return (
    <div
      className={`evt ${thin ? 'is-thin' : ''} ${open ? 'open' : ''}`}
      style={{
        top: (item.start / 60) * hourPx,
        height,
        left: cols > 1 ? `calc(${(100 * col) / cols}% + ${col ? gap / 2 : 0}px)` : undefined,
        width: cols > 1 ? `calc(${100 / cols}% - ${gap / 2}px)` : undefined,
        ['--evt-color' as string]: e.color ?? undefined,
      }}
      data-testid="event"
      data-uid={e.uid}
      onClick={(ev) => ev.stopPropagation()}
    >
      <button type="button" className="evt-main" aria-expanded={open} aria-label={`${e.title || 'Busy'}, ${time}, calendar event`} onClick={() => setOpen(!open)}>
        <span className="evt-chip" aria-hidden="true"><Icon name="ui-week" size={12} /></span>
        <span className="evt-title">{e.title || 'Busy'}</span>
        <span className="evt-time tnum">{thin ? fmtClock(item.start, clock24) : time}</span>
      </button>
      {open && (
        <div className="evt-pop" role="dialog" aria-label={e.title || 'Event'} data-testid="event-details">
          <b>{e.title || 'Busy'}</b>
          <span className="tnum">{time}</span>
          {e.location && <span>{e.location}</span>}
          <span className="muted">{calendarName ?? 'iCloud'} · read-only</span>
        </div>
      )}
    </div>
  )
})
