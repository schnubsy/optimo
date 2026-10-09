import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { db } from './data/db'
import * as repo from './data/repo'
import { useCategories, useSettings } from './data/hooks'
import type { Category, SettingsData, Task } from './data/types'
import { SyncEngine } from './sync/engine'
import { supabase } from './sync/remote'
import { useSync } from './state/sync'
import { useUI } from './state/ui'
import { useDrag } from './state/drag'
import { Header, PaneHeader } from './chrome/Header'
import { TabBar, type TabId } from './chrome/TabBar'
import { Fab } from './chrome/Fab'
import { PanelSheet } from './chrome/PanelSheet'
import { Toast } from './components/Toast'
import { Day } from './views/Day'
import { Inbox } from './views/Inbox'
import { Wizard } from './editor/Wizard'
import { PlacePicker } from './components/PlacePicker'
import { Categories } from './categories/Categories'
import { IconSheet } from './icons/IconSheet'
import { Week, weekMaps } from './views/Week'
import { Month } from './views/Month'
import { Settings } from './views/Settings'
import { Plan } from './plan/Plan'
import { Focus } from './focus/Focus'
import { startReminders } from './reminders/scheduler'
import { applyTheme } from './lib/theme'
import { keyBefore, inboxOrder } from './inbox/virtual'
import { useItems, type Item } from './timeline/items'
import { useCalendarSync, useEvents, type EventItem } from './calendar/events'
import { segmentMaps, timelineEls } from './timeline/Timeline'
import { clampStart, MIN_DURATION, snap } from './timeline/layout'
import { useNow } from './timeline/NowLine'
import { edgeStep, pointOf, scrollerAt, type Pt } from './lib/dragScroll'
import { addDays, dateKey, fromKey, nowMinutes, todayKey } from './lib/time'
import { useIsMobile } from './lib/useMedia'
import { deleteItem, moveItem, resizeItem, schedule, toggleComplete, unschedule } from './actions'
import { seedCategories } from './categories/defaults'
import './styles/app.css'

function useSyncEngine(userId: string) {
  useEffect(() => {
    const sb = supabase()
    if (!sb) {
      useSync.getState().set({ state: 'local' })
      return
    }
    const engine = new SyncEngine(sb, userId)
    // seed after the first sync attempt so a device never out-votes categories it has not pulled yet
    void engine.start().then(() => engine.run()).then(seedCategories)
    try {
      if (localStorage.getItem('optimo.test') === '1') Object.assign(window, { __optimo: { db, repo, engine, ui: useUI, maps: segmentMaps } })
    } catch {
      /* no storage */
    }
    return () => engine.stop()
  }, [userId])
}

const isTyping = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))

// Prefer the droppable under the pointer (timeline vs inbox rail); fall back to rect overlap for touch.
// Inbox rows beat the inbox container (reorder), and a row never targets itself.
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  const self = `row:${String(args.active.id).replace(/^inbox:/, '')}`
  const rows = hits.filter((h) => String(h.id).startsWith('row:') && h.id !== self)
  if (rows.length) return rows
  const rest = hits.filter((h) => h.id !== self)
  return rest.length ? rest : rectIntersection(args).filter((h) => h.id !== self)
}

export function Planner({ userId }: { userId: string }) {
  useSyncEngine(userId)
  const settings = useSettings()
  const cats = useCategories()
  const catMap = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats])
  const { date, view, panel, set, mobileTab: tab, quickAdd, draft, openWizard } = useUI()
  // legacy create entries (Timeline createAt / FreeGap set `draft`; anything setting `quickAdd`) open the wizard
  useEffect(() => {
    if (draft) openWizard('timeline', draft)
    else if (quickAdd) openWizard('timeline')
  }, [draft, quickAdd, openWizard])
  const nearBar = useDrag((s) => s.nearBar)
  const isMobile = useIsMobile()
  // iPhone: the week is the collapsed day panel (slice 4) — `view: 'week'` (W key, a spec, a stale state) maps onto it
  useEffect(() => {
    if (isMobile && view === 'week') set({ view: 'day', panel: 'week' })
  }, [isMobile, view, set])
  // the overview stays mounted while the sheet moves (drag / snap), so it is there as the panel slides off it
  const [sheetMoving, setSheetMoving] = useState(false)
  const now = useNow()
  const days = useMemo(() => [date], [date])
  const itemsByDay = useItems(days)
  const items = useMemo(() => {
    if (itemsByDay) performance.mark('optimo:day-data')
    return itemsByDay?.[date] ?? []
  }, [itemsByDay, date])
  const eventsByDay = useEvents(days)
  const dayEvents = useMemo(() => eventsByDay[date] ?? [], [eventsByDay, date])
  useCalendarSync(!!supabase())
  useEffect(() => applyTheme(settings.theme), [settings.theme])
  useEffect(() => startReminders(), [])
  // a notification click (service worker) or a ?date= deep link opens that day
  useEffect(() => {
    const open = (href: string) => {
      const d = new URL(href, location.href).searchParams.get('date')
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) useUI.getState().set({ date: d, view: 'day', mobileTab: 'board', panel: 'day' })
    }
    open(location.href)
    const onMsg = (e: MessageEvent) => e.data?.type === 'optimo:open' && open(e.data.url)
    navigator.serviceWorker?.addEventListener('message', onMsg)
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg)
  }, [])
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  // ---------- drag & drop ----------
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 400, tolerance: 10 } }),
  )
  // arc 7 slice 4: drops follow the POINTER, not the dragged card's top edge. The live pointer comes from window
  // listeners (capture phase: they run before dnd-kit's own move handling); `grab` is the pointer's offset inside a
  // dragged block at the start, so a block keeps "dragged delta" semantics in content px even while a container scrolls.
  const drag = useRef<DragSession | null>(null)
  const settingsRef = useRef(settings)
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  /** The minute a drop lands on (day timeline or week column) — arc 6 RULE: through that target's own segment map. */
  const dropMinute = useCallback((a: DragData | undefined, o: DropData | undefined): number | null => {
    const d = drag.current
    if (!a || !o?.day || !d) return null
    const s = settingsRef.current
    const len = a.item?.task.duration_min ?? a.task?.duration_min ?? s.default_duration
    let y: number
    let toMin: (y: number) => number
    if (o.type === 'timeline') {
      const map = segmentMaps.get(o.day)
      const el = timelineEls.get(o.day)
      if (!map || !el) return null
      y = d.p.y - el.getBoundingClientRect().top
      toMin = map.yToMin
    } else if (o.type === 'day') {
      const to = weekMaps.get(o.day)
      const col = weekCol(o.day)
      if (!to || !col) return null
      y = d.p.y - col.getBoundingClientRect().top + to.origin
      toMin = to.map.yToMin
    } else return null
    // a block: its top follows the pointer (grab offset kept); an inbox / tray item starts at the pointer's minute
    const min = toMin(a.type === 'block' ? y - d.grab : y)
    return clampStart(snap(min, s.snap), len)
  }, [])

  // the ghost: where the drop will land (day timeline or a week column) with its live start–end
  const showGhost = useCallback(() => {
    const d = drag.current
    if (!d) return
    const o = d.over
    if ((o?.type === 'timeline' || o?.type === 'day') && o.day) {
      const m = dropMinute(d.data, o)
      const len = d.data?.item?.task.duration_min ?? d.data?.task?.duration_min ?? settingsRef.current.default_duration
      if (m !== null) {
        const where = o.type === 'day' ? 'week' : 'day'
        const g = useDrag.getState().ghost
        if (!g || g.start !== m || g.day !== o.day || g.where !== where || g.len !== len) useDrag.getState().set({ ghost: { day: o.day, start: m, len, where } })
        return
      }
    }
    if (useDrag.getState().ghost) useDrag.getState().set({ ghost: null })
  }, [dropMinute])

  const endDrag = useCallback(() => {
    const d = drag.current
    if (d) {
      cancelAnimationFrame(d.raf)
      d.off()
    }
    drag.current = null
    useDrag.getState().set({ ghost: null, activeId: null, nearBar: false })
  }, [])
  useEffect(() => endDrag, [endDrag])

  const onDragStart = (e: DragStartEvent) => {
    endDrag() // a stale session (a drag that never ended) must not keep its listeners
    useDrag.getState().set({ activeId: String(e.active.id) })
    useUI.getState().set({ selectedId: null })
    const start = pointOf(e.activatorEvent) ?? { x: 0, y: 0 }
    const data = e.active.data.current as DragData | undefined
    // the block's top edge at the start, in client px (its day row / week node) → the pointer's offset inside it
    let grab = 0
    if (data?.type === 'block' && data.item) {
      if (String(e.active.id).startsWith('wblk:')) {
        const k = dayOfItem(data.item, '')
        const w = weekMaps.get(k)
        const col = weekCol(k)
        if (w && col) grab = start.y - (col.getBoundingClientRect().top + w.map.minToY(data.item.start) - w.origin)
      } else {
        const day = useUI.getState().date
        const map = segmentMaps.get(day)
        const el = timelineEls.get(day)
        if (map && el) grab = start.y - (el.getBoundingClientRect().top + map.minToY(data.item.start))
      }
    }
    const bar = document.querySelector('[data-testid="tabbar"]')?.getBoundingClientRect()
    const onMove = (ev: Event) => {
      const p = pointOf(ev)
      if (p && drag.current === d) d.p = p
    }
    const opts = { capture: true, passive: true } as const
    const types = ['pointermove', 'mousemove', 'touchmove']
    const d: DragSession = {
      start,
      p: { ...start },
      grab,
      data,
      barTop: bar && bar.height ? bar.top : Infinity,
      raf: 0,
      edgeSince: 0,
      off: () => types.forEach((t) => window.removeEventListener(t, onMove, opts)),
    }
    types.forEach((t) => window.addEventListener(t, onMove, opts))
    drag.current = d
    // edge auto-scroll: the scroller under the pointer, ≤ 48 px from its edge, after a 200 ms dwell, ≤ 12 px a frame, the
    // way the pointer went (the old 15 % threshold at up to 2 000 px/s scrolled under quick drops and ran away)
    const tick = () => {
      if (drag.current !== d) return
      const dy = d.p.y - d.start.y
      const dir = dy > 8 ? 1 : dy < -8 ? -1 : 0
      const sc = dir ? scrollerAt(d.p) : null
      const r = sc?.getBoundingClientRect()
      const step = sc && r ? edgeStep(d.p.y, r.top, Math.min(r.bottom, d.barTop), dir) : 0
      // a dwell before the first step: a quick drop near the edge lands where it was aimed, it never scrolls first
      const t = performance.now()
      if (!step) d.edgeSince = 0
      else if (!d.edgeSince) d.edgeSince = t
      else if (sc && t - d.edgeSince >= EDGE_DWELL_MS) {
        const before = sc.scrollTop
        sc.scrollTop = before + step
        if (sc.scrollTop !== before) showGhost()
      }
      d.raf = requestAnimationFrame(tick)
    }
    d.raf = requestAnimationFrame(tick)
  }
  const onDragMove = (e: DragMoveEvent) => {
    const r = e.active.rect.current.translated
    const bar = document.querySelector('[data-testid="tabbar"]')?.getBoundingClientRect()
    const near = !!(r && bar && r.bottom > bar.top - 80)
    if (near !== useDrag.getState().nearBar) useDrag.getState().set({ nearBar: near })
    if (drag.current) drag.current.over = e.over?.data.current as DropData | undefined
    showGhost()
  }
  const onDragEnd = (e: DragEndEvent) => {
    const o = e.over?.data.current as DropData | undefined
    const a = e.active.data.current as DragData | undefined
    if (drag.current) drag.current.over = o
    const m = o && a && (o.type === 'timeline' || o.type === 'day') ? dropMinute(a, o) : null
    endDrag()
    if (!o || !a) return
    if (o.type === 'timeline' && o.day) {
      if (m === null) return
      if (a.type === 'block' && a.item) void moveItem(a.item, o.day, m)
      else if (a.task) void schedule(a.task, o.day, m)
    } else if (o.type === 'plan' && o.day) {
      // arc 7 slice 9 (shared drag contract): a "To place" tray / week day header plans the task for that day, untimed
      void planDrop(a, o.day)
    } else if (o.type === 'row' && a.type === 'inbox' && a.task && o.task && a.task.id !== o.task.id) {
      void reorderInbox(a.task, o.task)
    } else if ((o.type === 'inbox' || o.type === 'row') && a.type === 'block' && a.item && !a.item.occurrence) {
      void unschedule(a.item.task)
    } else if (o.type === 'day' && o.day && m !== null) {
      // week columns: the target column's map reads the pointer (arc 6 RULE); a block keeps its grab offset
      if (a.type === 'block' && a.item) void moveItem(a.item, o.day, m)
      else if (a.task) void schedule(a.task, o.day, m)
    }
  }

  // ---------- keyboard map (directions.md cross-cutting #6) ----------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const ui = useUI.getState()
      const cmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'
      if (cmdK || (e.key === '/' && !isTyping(e.target))) {
        e.preventDefault()
        if (matchMedia('(max-width: 899px)').matches) useUI.getState().openWizard('timeline')
        else document.getElementById('quickadd')?.focus()
        return
      }
      if (isTyping(e.target) || ui.editingId || ui.draft || ui.wizard || e.metaKey || e.ctrlKey || e.altKey) return
      const sel = itemsRef.current.find((i) => i.key === ui.selectedId)
      const step = settings.snap
      switch (e.key) {
        case 'n':
        case 'N': {
          e.preventDefault()
          const start = Math.ceil(nowMinutes() / 15) * 15
          ui.openWizard('timeline', { start_at: new Date(fromKey(ui.date).getTime() + start * 60000).toISOString(), duration_min: settings.default_duration })
          return
        }
        case 'd':
        case 'D':
          ui.set({ view: 'day' })
          return
        case 'w':
        case 'W':
          ui.set({ view: 'week' })
          return
        case 'm':
        case 'M':
          ui.set({ view: 'month' })
          return
        case 't':
        case 'T':
          ui.set({ date: todayKey(), view: ui.view === 'focus' ? 'day' : ui.view })
          return
        case 'f':
        case 'F':
          if (sel) ui.set({ focusId: sel.key, view: 'focus' })
          return
        case 'Escape':
          ui.set({ selectedId: null })
          return
      }
      if (!sel) {
        if (e.key === 'ArrowLeft') ui.set({ date: addDays(ui.date, -1) })
        if (e.key === 'ArrowRight') ui.set({ date: addDays(ui.date, 1) })
        return
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        const d = e.key === 'ArrowUp' ? -step : step
        // Shift+↑/↓ resizes by 5 min (never below the minimum); plain arrows nudge by the snap step
        if (e.shiftKey) void resizeItem(sel, Math.max(MIN_DURATION, sel.task.duration_min + (e.key === 'ArrowUp' ? -5 : 5)))
        else void moveItem(sel, ui.date, clampStart(sel.start + d, sel.task.duration_min))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        ui.set({ editingId: sel.key })
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        void deleteItem(sel)
      } else if (e.key === 'x' || e.key === 'X') {
        void toggleComplete(sel)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settings.snap, settings.default_duration])

  // arc 6: four tabs — Day / Week / Month all live under Timeline (week is the collapsed panel, slice 4)
  const mobileTabId: TabId = tab === 'backlog' ? 'inbox' : view === 'settings' ? 'settings' : view === 'plan' ? 'plan' : 'timeline'
  const onTab = (t: TabId) => {
    if (t === 'inbox') set({ mobileTab: 'backlog' })
    else set({ mobileTab: 'board', view: t === 'timeline' ? 'day' : t })
  }
  // re-tapping the active Timeline tab toggles the panel detent (from month: back to the day first)
  const onReselect = (t: TabId) => {
    if (t !== 'timeline') return
    if (view !== 'day') set({ view: 'day' })
    else set({ panel: panel === 'week' ? 'day' : 'week' })
  }
  const weekMode = isMobile && tab !== 'backlog' && view === 'day' && panel === 'week'
  const hdr = { date, view, weekStartsOn: settings.week_start, now, clock24: settings.clock24 }
  // arc 7 slice 3: the iPhone date header + strip belong to the Timeline only (day / week / month) — AI, Settings and
  // its sub-pages have their own titles, and a strip tap there would change the date out of sight
  const timelineView = view === 'day' || view === 'week' || view === 'month' || view === 'focus'
  const showHeader = tab !== 'backlog' && timelineView
  return (
    <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd} onDragCancel={endDrag} autoScroll={false}>
      <div className={`app ${isMobile ? 'is-mobile' : 'is-desktop'}`}>
        {isMobile ? (
          <>
            {/* mockup 07: the inbox screen carries its own title — no day header over it */}
            {showHeader && <Header {...hdr} weekMode={weekMode} />}
            {/* without the date header (its title is the page h1) AI / Settings keep a page-level heading; the visible
                page titles stay h2 so their h3 sections keep the heading order */}
            <main className={`pane m-${tab === 'backlog' ? 'inbox' : view === 'week' ? 'day' : view} ${showHeader || tab === 'backlog' ? '' : 'no-hdr'}`}>
              {!showHeader && tab !== 'backlog' && <h1 className="sr-only">optimo</h1>}
              {tab === 'backlog' ? (
                <Inbox cats={catMap} />
              ) : view === 'day' || view === 'week' ? (
                <>
                  {(panel === 'week' || sheetMoving) && <Week date={date} cats={catMap} settings={settings} overview />}
                  <PanelSheet onMotion={setSheetMoving}>
                    <Day day={date} items={items} events={dayEvents} cats={catMap} settings={settings} />
                  </PanelSheet>
                </>
              ) : (
                <ViewSwitch view={view} date={date} items={items} events={dayEvents} catMap={catMap} settings={settings} />
              )}
            </main>
            <TabBar active={mobileTabId} onChange={onTab} onReselect={onReselect} timelineGlyph={weekMode ? 'ui-grid-2x3' : undefined} recede={nearBar} />
            <Fab />
          </>
        ) : (
          <>
            <div className="body">
              <Inbox cats={catMap} />
              <main className="pane">
                <PaneHeader {...hdr} />
                <ViewSwitch view={view} date={date} items={items} events={dayEvents} catMap={catMap} settings={settings} />
              </main>
            </div>
            <footer className="foot" aria-label="Keyboard">
              <span><kbd>N</kbd> new</span>
              <span><kbd>X</kbd> done</span>
              <span><kbd>↑</kbd><kbd>↓</kbd> move {settings.snap} min</span>
              <span><kbd>⇧</kbd><kbd>↓</kbd> resize 5 min</span>
              <span><kbd>Enter</kbd> edit</span>
              <span><kbd>/</kbd> quick add</span>
              <span><kbd>←</kbd><kbd>→</kbd> day</span>
            </footer>
          </>
        )}
        <Wizard settings={settings} cats={cats} />
        <PlacePicker />
        {view === 'focus' && <Focus />}
        <Toast />
      </div>
    </DndContext>
  )
}

interface DragData {
  type: string
  item?: Item
  task?: Task
}
interface DropData {
  type: string
  day?: string
  task?: Task
}
/** One drag, start to drop: the activator point, the live pointer, a block's grab offset, the auto-scroll frame. */
interface DragSession {
  start: Pt
  p: Pt
  grab: number
  data?: DragData
  over?: DropData
  barTop: number
  raf: number
  /** when the pointer entered an edge band (performance.now(); 0 = not in one) */
  edgeSince: number
  off: () => void
}
/** The pointer must rest this long in an edge band before auto-scroll starts. */
const EDGE_DWELL_MS = 200

const weekCol = (day: string) => document.querySelector<HTMLElement>(`[data-testid="week-col"][data-day="${day}"]`)
const LONG_DAY = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' })

/** A drop on a "To place" tray or a week day header: plan for that day (untimed), with Undo. Repeating rows stay. */
async function planDrop(a: DragData, day: string) {
  const task = a.type === 'block' ? a.item?.task : a.task
  if (!task) return
  const notify = useUI.getState().notify
  if (a.item?.occurrence || task.rrule || task.series_id) {
    notify({ text: 'A repeating task can’t be unscheduled — edit it on the timeline' })
    return
  }
  const before = await db.tasks.get(task.id)
  if (!before || before.deleted_at) return
  if (!before.start_at && !before.someday && before.plan_date === day) return
  await repo.planForDay(task.id, day)
  notify({ text: `To place ${day === todayKey() ? 'today' : LONG_DAY.format(fromKey(day))}`, undo: () => repo.restoreTask(before).then(() => undefined) })
}

/** The week column a dragged block came from: the day its start falls on (falls back to the target day). */
function dayOfItem(item: Item, fallback: string): string {
  const k = item.occurrence?.date ?? dateKey(new Date(item.task.start_at!))
  return weekMaps.has(k) ? k : fallback
}

async function reorderInbox(moving: Task, target: Task) {
  const list = inboxOrder((await db.tasks.where('_kind').equals('inbox').toArray()).filter((t) => t.id !== moving.id))
  const same = list.filter((t) => t.priority === target.priority)
  await repo.updateTask(moving.id, { sort_key: keyBefore(same, target.id), priority: target.priority })
}

function ViewSwitch({ view, date, items, events, catMap, settings }: { view: string; date: string; items: Item[]; events: EventItem[]; catMap: Map<string, Category>; settings: SettingsData }) {
  if (view === 'categories') return <Categories />
  if (view === 'icons') return <IconSheet />
  if (view === 'settings') return <Settings />
  if (view === 'plan') return <Plan cats={catMap} settings={settings} />
  if (view === 'week') return <Week date={date} cats={catMap} settings={settings} />
  if (view === 'month') return <Month date={date} cats={catMap} settings={settings} />
  return <Day day={date} items={items} events={events} cats={catMap} settings={settings} />
}
