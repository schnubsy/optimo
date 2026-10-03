import { memo, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../icons/Icon'
import { fmtClock } from '../lib/time'
import { useIsMobile } from '../lib/useMedia'
import type { EventItem } from '../calendar/events'
import { pillHeight } from './Block'
import '../editor/sheet.css'

/** #19: the read-only details, shared by the desktop popover and the mobile bottom sheet. */
function EventDetails({ title, time, location, calendarName }: { title: string; time: string; location: string | null; calendarName: string }) {
  return (
    <>
      <b>{title}</b>
      <span className="tnum">{time}</span>
      {location && <span>{location}</span>}
      <span className="muted">{calendarName} · read-only</span>
    </>
  )
}

/**
 * A calendar event on the timeline: an outlined (not filled) pill with a small calendar chip, fixed in place
 * (not draggable or resizable); tap shows its details — a popover on desktop, a read-only bottom sheet below
 * 900px (#19) so it no longer floats over neighbouring pills with no way to dismiss it.
 */
export const EventBlock = memo(function EventBlock({ item, col, cols, hourPx, clock24, calendarName }: { item: EventItem; col: number; cols: number; hourPx: number; clock24: boolean; calendarName?: string }) {
  const [open, setOpen] = useState(false)
  const mobile = useIsMobile()
  const e = item.event
  const height = pillHeight(item.end - item.start, hourPx)
  const thin = height < 44
  const time = `${fmtClock(item.start, clock24)}–${fmtClock(item.end, clock24)}`
  const gap = 4
  const title = e.title || 'Busy'
  const calName = calendarName ?? 'iCloud'
  useEffect(() => {
    if (!open) return
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
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
      <button type="button" className="evt-main" aria-expanded={open} aria-label={`${title}, ${time}, calendar event`} onClick={() => setOpen(!open)}>
        <span className="evt-chip" aria-hidden="true"><Icon name="ui-calendar" size={12} /></span>
        <span className="evt-title">{title}</span>
        <span className="evt-time tnum">{thin ? fmtClock(item.start, clock24) : time}</span>
      </button>
      {open && !mobile && (
        <div className="evt-pop" role="dialog" aria-label={title} data-testid="event-details">
          <EventDetails title={title} time={time} location={e.location} calendarName={calName} />
        </div>
      )}
      {/* portalled to the .app root: inside .evt (z 25) the fixed sheet was trapped below the tab bar + FAB (z 30);
          the root (not <body>) keeps the .is-mobile sheet styles */}
      {open && mobile && createPortal(
        <div className="sheet-wrap" role="presentation" onMouseDown={(ev) => ev.target === ev.currentTarget && setOpen(false)}>
          <div className="sheet evt-sheet" role="dialog" aria-modal="true" aria-label={title} data-testid="event-details">
            <i className="grabber" aria-hidden="true" />
            <header className="sheet-hd">
              <h2 className="sr-only">Event</h2>
              <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close">
                <Icon name="ui-close" size={16} />
              </button>
            </header>
            <EventDetails title={title} time={time} location={e.location} calendarName={calName} />
          </div>
        </div>,
        document.querySelector('.app') ?? document.body,
      )}
    </div>
  )
})
