import { useMemo, useRef, type PointerEvent as RPointerEvent } from 'react'
import { SyncBadge } from '../components/SyncBadge'
import { useCategories, useSettings } from '../data/hooks'
import { Icon } from '../icons/Icon'
import { QuickAdd } from '../quickadd/QuickAdd'
import { taskIcon } from '../quickadd/suggest'
import { addDays, fmtClock, fromKey, todayKey, weekStart } from '../lib/time'
import { useItems, type Item } from '../timeline/items'
import { useUI, type View } from '../state/ui'
import { SegmentedControl } from './SegmentedControl'
import './header.css'

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
/** Strip mini-chips: at most this many discs, then `+n`. */
const MAX_CHIPS = 4

interface Props {
  date: string
  view: View
  weekStartsOn: 0 | 1
  now: number
  clock24: boolean
}

/** Title grammar (arc 6): `October 9, 2026 ›` — month + day in ink, year (+ chevron) in accent; week mode drops the day. */
function Title({ date, weekMode, chevron }: { date: string; weekMode?: boolean; chevron?: boolean }) {
  const d = fromKey(date)
  return (
    <>
      <span className="hdr-md">{MONTH[d.getMonth()]}{weekMode ? '' : ` ${d.getDate()},`}</span>{' '}
      <span className="hdr-year" data-testid="hdr-year">{d.getFullYear()}{chevron ? ' ›' : ''}</span>
    </>
  )
}

interface Chip { key: string; icon: string; color: string }

/** A day's mini-chips: the wake bookend, that day's timed tasks by start, the lights-out bookend. */
function dayChips(items: Item[], cats: Map<string, { color: string; icon?: string }>, overrides?: Record<string, string>): Chip[] {
  const timed = items.filter((i) => !i.task.all_day && !i.task.deleted_at).sort((a, b) => a.start - b.start)
  return [
    { key: 'wake', icon: 'rest-alarm', color: 'accent' },
    ...timed.map((i) => {
      const c = cats.get(i.task.category_id ?? '')
      return { key: i.key, icon: taskIcon(i.task.title, c?.icon, overrides), color: c?.color ?? 'errand' }
    }),
    { key: 'sleep', icon: 'rest-moon', color: 'errand' },
  ]
}

function MiniChips({ chips }: { chips: Chip[] }) {
  const shown = chips.length > MAX_CHIPS ? chips.slice(0, MAX_CHIPS) : chips
  const more = chips.length - shown.length
  return (
    <span className="hdr-chips" aria-hidden="true">
      {shown.map((c) => (
        <i key={c.key} className={`hdr-chip cat-${c.color}`} data-testid="mini-chip" data-icon={c.icon}>
          <Icon name={c.icon} size={8} />
        </i>
      ))}
      {more > 0 && <span className="hdr-more" data-testid="mini-more">+{more}</span>}
    </span>
  )
}

/** Mobile header (arc 6, mockup 01): title row + 7-day strip with mini-chips, solid canvas, no border, 131px. */
export function Header({ date, weekStartsOn, weekMode }: Props & { weekMode?: boolean }) {
  const set = useUI((s) => s.set)
  const settings = useSettings()
  const catList = useCategories()
  const cats = useMemo(() => new Map(catList.map((c) => [c.id, c])), [catList])
  const d = fromKey(date)
  const start = weekStart(date, weekStartsOn)
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start])
  const items = useItems(days)
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
    <header className={`hdr ${weekMode ? 'week-mode' : ''}`} data-testid="header">
      <div className="hdr-top">
        <h1 className="hdr-title" data-testid="hdr-title">
          <button type="button" className="hdr-title-btn" onClick={() => set({ view: 'month', mobileTab: 'board' })} aria-label={`${d.toDateString()}, open month`}>
            <Title date={date} weekMode={weekMode} chevron />
          </button>
        </h1>
        {date !== today && (
          <button type="button" className="hdr-today" onClick={() => set({ date: today })}>
            Today
          </button>
        )}
        <SyncBadge />
      </div>
      <div className="hdr-strip" role="group" aria-label="Week" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => (swipe.current = null)}>
        {days.map((k) => {
          const x = fromKey(k)
          return (
            <button key={k} type="button" className={`hdr-day ${k === date ? 'sel' : ''} ${k === today ? 'today' : ''}`} aria-pressed={k === date} aria-label={x.toDateString()} onClick={() => set({ date: k })} data-testid="strip-day" data-day={k}>
              <span className="wd">{WD[x.getDay()]}</span>
              <b className="tnum">{x.getDate()}</b>
              {!weekMode && <MiniChips chips={dayChips(items?.[k] ?? [], cats, settings.iconOverrides)} />}
            </button>
          )
        })}
      </div>
    </header>
  )
}

/** Desktop pane header (72px): segmented Day · Week · Month, ‹ title ›, quick-add pill, plan + settings, sync. */
export function PaneHeader({ date, view, now, clock24 }: Props) {
  const set = useUI((s) => s.set)
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
        <h1 className="pane-h1" data-testid="hdr-title">
          <Title date={date} />
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
