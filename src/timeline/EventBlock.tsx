import { memo, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../icons/Icon'
import { fmtRange } from '../lib/time'
import { useIsMobile } from '../lib/useMedia'
import type { EventItem } from '../calendar/events'
import type { SegmentMap } from './segments'
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
 * A calendar event on the spine (arc 6): an outlined disc in the calendar's colour with a calendar glyph, the title and
 * time beside it — fixed in place (not draggable, no ring); tap shows its details — a popover on desktop, a read-only
 * bottom sheet below 900px (#19). Placed by the day's segment map like every other row.
 */
export const EventBlock = memo(function EventBlock({ item, map, col, textCols, textTop, clock24, calendarName }: { item: EventItem; map: SegmentMap; col: number; textCols?: number; textTop?: number; clock24: boolean; calendarName?: string }) {
  const [open, setOpen] = useState(false)
  const mobile = useIsMobile()
  const e = item.event
  const top = map.minToY(item.start)
  const height = Math.max(1, map.minToY(item.end) - top)
  const time = fmtRange(item.start, item.end, clock24)
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
      className={`evt node disc ${open ? 'open' : ''}`}
      style={{ top, height, ['--col' as string]: col, ['--text-cols' as string]: textCols ?? col, ['--text-top' as string]: textTop !== undefined ? `${textTop}px` : undefined, ['--chip-h' as string]: '56px', ['--evt-color' as string]: e.color ?? undefined }}
      data-testid="event"
      data-uid={e.uid}
      onClick={(ev) => ev.stopPropagation()}
    >
      <button type="button" className="node-chip evt-chip" aria-expanded={open} aria-label={`${title}, ${time}, calendar event`} onClick={() => setOpen(!open)}>
        <Icon name="ui-calendar" size={22} />
      </button>
      <button type="button" className={`node-text ${textTop !== undefined ? 'stacked' : ''}`} tabIndex={-1} aria-hidden="true" onClick={() => setOpen(!open)}>
        <span className="node-meta tnum">{time}</span>
        <span className="node-title evt-title">{title}</span>
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
