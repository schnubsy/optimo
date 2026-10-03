import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { SyncBadge } from '../components/SyncBadge'
import { Icon } from '../icons/Icon'
import { QuickAdd } from '../quickadd/QuickAdd'
import { addDays, fmtClock, fmtHours, fromKey, todayKey, weekStart } from '../lib/time'
import type { DayStats } from '../views/stats'
import { useUI, type View } from '../state/ui'
import { SegmentedControl } from './SegmentedControl'

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WDL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface Props {
  date: string
  view: View
  stats: DayStats
  inboxCount: number
  weekStartsOn: 0 | 1
  now: number
  clock24: boolean
}

/** Stats line: planned · free · done (testids kept for the specs). */
function Stats({ stats, inboxCount, desktop }: { stats: DayStats; inboxCount: number; desktop?: boolean }) {
  return (
    <p className="hdr-stats tnum">
      <span><b data-testid="stat-planned">{fmtHours(stats.planned)}</b> planned</span>
      <span><b data-testid="stat-free">{fmtHours(stats.free)}</b> free</span>
      <span><b data-testid="stat-done">{stats.done}/{stats.total}</b> done</span>
      {stats.late > 0 && <span className="hdr-late"><b>{stats.late}</b> late</span>}
      {desktop && <span><b data-testid="stat-unplaced">{inboxCount}</b> in inbox</span>}
    </p>
  )
}

/** Mobile header: day title + stats + a 7-day strip, on the canvas→transparent fade; no border (spec §5.5). */
export function Header({ date, stats, inboxCount, weekStartsOn, scrolled }: Props & { scrolled: boolean }) {
  const set = useUI((s) => s.set)
  const d = fromKey(date)
  const start = weekStart(date, weekStartsOn)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const today = todayKey()
  const swipe = useRef<number | null>(null)
  const onDown = (e: RPointerEvent) => (swipe.current = e.clientX)
  const onUp = (e: RPointerEvent) => {
    if (swipe.current === null) return
    const dx = e.clientX - swipe.current
    swipe.current = null
    if (Math.abs(dx) > 50) set({ date: addDays(date, dx < 0 ? 7 : -7) })
  }
  return (
    <header className={`hdr ${scrolled ? 'scrolled' : ''}`} data-testid="header">
      <div className="hdr-top">
        <h1 className="hdr-title">
          <button type="button" className="hdr-title-btn" onClick={() => set({ view: 'month', mobileTab: 'board' })} aria-label={`${d.toDateString()}, open month`}>
            {WDL[d.getDay()]} <span className="hdr-date">{d.getDate()} {MO[d.getMonth()]} ›</span>
          </button>
        </h1>
        {date !== today && (
          <button type="button" className="hdr-today" onClick={() => set({ date: today })}>
            Today
          </button>
        )}
        <SyncBadge />
      </div>
      <Stats stats={stats} inboxCount={inboxCount} />
      <div className="hdr-strip" role="group" aria-label="Week" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => (swipe.current = null)}>
        {days.map((k) => {
          const x = fromKey(k)
          return (
            <button key={k} type="button" className={`hdr-day ${k === date ? 'sel' : ''} ${k === today ? 'today' : ''}`} aria-pressed={k === date} aria-label={x.toDateString()} onClick={() => set({ date: k })}>
              <span className="wd">{WD[x.getDay()]}</span>
              <b className="tnum">{x.getDate()}</b>
            </button>
          )
        })}
      </div>
    </header>
  )
}

/** Desktop pane header (72px): segmented Day · Week · Month, ‹ title ›, stats, quick-add pill, settings, sync. */
export function PaneHeader({ date, view, stats, inboxCount, now, clock24 }: Props) {
  const set = useUI((s) => s.set)
  const d = fromKey(date)
  const today = todayKey()
  const seg = view === 'week' || view === 'month' ? view : 'day'
  return (
    <header className="pane-hdr" data-testid="header">
      <SegmentedControl
        label="View"
        value={seg}
        items={[
          { id: 'day', label: 'Day' },
          { id: 'week', label: 'Week' },
          { id: 'month', label: 'Month' },
        ]}
        onChange={(v) => set({ view: v })}
      />
      <div className="pane-title">
        <button type="button" className="nav" aria-label="Previous day" onClick={() => set({ date: addDays(date, -1) })}>
          <Icon name="ui-chevron-left" size={18} />
        </button>
        <h1>
          {WDL[d.getDay()]} <span className="hdr-date">{d.getDate()} {MO[d.getMonth()]}</span>
        </h1>
        <button type="button" className="nav" aria-label="Next day" onClick={() => set({ date: addDays(date, 1) })}>
          <Icon name="ui-chevron-right" size={18} />
        </button>
        {date !== today ? (
          <button type="button" className="hdr-today" onClick={() => set({ date: today })}>
            Today
          </button>
        ) : (
          <span className="hdr-now tnum" aria-label={`Now ${fmtClock(now, clock24)}`}>{fmtClock(now, clock24)}</span>
        )}
      </div>
      <Stats stats={stats} inboxCount={inboxCount} desktop />
      <div className="pane-qa">
        <QuickAdd />
      </div>
      <button type="button" className={`gear ${view === 'plan' ? 'on' : ''}`} aria-label="Plan" aria-pressed={view === 'plan'} onClick={() => set({ view: view === 'plan' ? 'day' : 'plan' })} data-testid="hdr-plan">
        <Icon name="ui-plan" size={20} filled={view === 'plan'} />
      </button>
      <button type="button" className={`gear ${view === 'settings' ? 'on' : ''}`} aria-label="Settings" aria-pressed={view === 'settings'} onClick={() => set({ view: view === 'settings' ? 'day' : 'settings' })}>
        <Icon name="ui-settings" size={20} filled={view === 'settings'} />
      </button>
      <SyncBadge />
    </header>
  )
}

/** Header stats fade after 40px of timeline scroll (design spec §7). */
export function useScrolled(): boolean {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    // the first scroll event is the timeline's own initial positioning — the baseline, not a user scroll
    const base = new WeakMap<HTMLElement, number>()
    const on = (e: Event) => {
      const t = e.target as HTMLElement
      if (!t?.classList?.contains('tl')) return
      if (!base.has(t)) base.set(t, t.scrollTop)
      setScrolled(t.scrollTop - base.get(t)! > 40)
    }
    document.addEventListener('scroll', on, { capture: true, passive: true })
    return () => document.removeEventListener('scroll', on, { capture: true })
  }, [])
  return scrolled
}
