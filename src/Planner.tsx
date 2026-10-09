import { useCallback, useEffect, useMemo, useRef } from 'react'
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
import { Toast } from './components/Toast'
import { TaskSheet } from './editor/TaskSheet'
import { Day } from './views/Day'
import { Inbox } from './views/Inbox'
import { Wizard } from './editor/Wizard'
import { PlacePicker } from './components/PlacePicker'
import { Categories } from './categories/Categories'
import { IconSheet } from './icons/IconSheet'
import { Week, WEEK_HOUR_PX } from './views/Week'
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
import { clampStart, MIN_DURATION, pxToMin, snap } from './timeline/layout'
import { useNow } from './timeline/NowLine'
import { addDays, fromKey, nowMinutes, todayKey } from './lib/time'
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
  const { date, view, set, mobileTab: tab, quickAdd, draft, openWizard } = useUI()
  // legacy create entries (Timeline createAt / FreeGap set `draft`; anything setting `quickAdd`) open the wizard
  useEffect(() => {
    if (draft) openWizard('timeline', draft)
    else if (quickAdd) openWizard('timeline')
  }, [draft, quickAdd, openWizard])
  const nearBar = useDrag((s) => s.nearBar)
  const isMobile = useIsMobile()
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
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) useUI.getState().set({ date: d, view: 'day', mobileTab: 'board' })
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
  // arc 6 RULE: the day's segment map is the only minute↔pixel conversion on the spine
  const dropMinute = useCallback(
    (e: DragMoveEvent | DragEndEvent, day: string): number | null => {
      const a = e.active.data.current as { type: string; item?: Item; task?: Task } | undefined
      const map = segmentMaps.get(day)
      if (!a || !map) return null
      if (a.type === 'block' && a.item) {
        const y = map.minToY(a.item.start) + e.delta.y
        return clampStart(snap(map.yToMin(y), settings.snap), a.item.task.duration_min)
      }
      const el = timelineEls.get(day)
      const r = e.active.rect.current.translated
      if (!el || !r) return null
      const min = map.yToMin(r.top - el.getBoundingClientRect().top)
      return clampStart(snap(min, settings.snap), a.task?.duration_min ?? settings.default_duration)
    },
    [settings.snap, settings.default_duration],
  )
  const onDragStart = (e: DragStartEvent) => {
    useDrag.getState().set({ activeId: String(e.active.id) })
    useUI.getState().set({ selectedId: null })
  }
  const onDragMove = (e: DragMoveEvent) => {
    const r = e.active.rect.current.translated
    const bar = document.querySelector('[data-testid="tabbar"]')?.getBoundingClientRect()
    const near = !!(r && bar && r.bottom > bar.top - 80)
    if (near !== useDrag.getState().nearBar) useDrag.getState().set({ nearBar: near })
    const o = e.over?.data.current as { type: string; day?: string } | undefined
    const a = e.active.data.current as { item?: Item; task?: Task } | undefined
    if (o?.type === 'timeline' && o.day) {
      const m = dropMinute(e, o.day)
      const len = a?.item?.task.duration_min ?? a?.task?.duration_min ?? settings.default_duration
      if (m !== null) {
        const g = useDrag.getState().ghost
        if (!g || g.start !== m || g.day !== o.day) useDrag.getState().set({ ghost: { day: o.day, start: m, len } })
        return
      }
    }
    if (useDrag.getState().ghost) useDrag.getState().set({ ghost: null })
  }
  const onDragEnd = (e: DragEndEvent) => {
    useDrag.getState().set({ ghost: null, activeId: null, nearBar: false })
    const o = e.over?.data.current as { type: string; day?: string; task?: Task } | undefined
    const a = e.active.data.current as { type: string; item?: Item; task?: Task } | undefined
    if (!o || !a) return
    if (o.type === 'timeline' && o.day) {
      const m = dropMinute(e, o.day)
      if (m === null) return
      if (a.type === 'block' && a.item) void moveItem(a.item, o.day, m)
      else if (a.task) void schedule(a.task, o.day, m)
    } else if (o.type === 'row' && a.type === 'inbox' && a.task && o.task && a.task.id !== o.task.id) {
      void reorderInbox(a.task, o.task)
    } else if ((o.type === 'inbox' || o.type === 'row') && a.type === 'block' && a.item && !a.item.occurrence) {
      void unschedule(a.item.task)
    } else if (o.type === 'day' && o.day && a.type === 'block' && a.item) {
      const m = clampStart(snap(a.item.start + pxToMin(e.delta.y, WEEK_HOUR_PX), settings.snap), a.item.task.duration_min)
      void moveItem(a.item, o.day, m)
    } else if (o.type === 'day' && o.day && a.task) {
      const col = document.querySelector(`[data-testid="week-col"][data-day="${o.day}"]`)
      const r = e.active.rect.current.translated
      const m = col && r ? snap(pxToMin(r.top - col.getBoundingClientRect().top, WEEK_HOUR_PX), settings.snap) : settings.day_start + 3 * 60
      void schedule(a.task, o.day, clampStart(m, a.task.duration_min))
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
  // interim until slice 4 drives the panel detent: re-tapping Timeline from week / month returns to the day
  const onReselect = (t: TabId) => {
    if (t === 'timeline' && view !== 'day') set({ view: 'day' })
  }
  const hdr = { date, view, weekStartsOn: settings.week_start, now, clock24: settings.clock24 }
  return (
    <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd} onDragCancel={() => useDrag.getState().set({ ghost: null, activeId: null, nearBar: false })} autoScroll={{ threshold: { x: 0, y: 0.15 } }}>
      <div className={`app ${isMobile ? 'is-mobile' : 'is-desktop'}`}>
        {isMobile ? (
          <>
            {/* mockup 07: the inbox screen carries its own title — no day header over it */}
            {tab !== 'backlog' && <Header {...hdr} />}
            <main className={`pane m-${tab === 'backlog' ? 'inbox' : view}`}>
              {tab === 'backlog' ? <Inbox cats={catMap} /> : <ViewSwitch view={view} date={date} items={items} events={dayEvents} catMap={catMap} settings={settings} />}
            </main>
            <TabBar active={mobileTabId} onChange={onTab} onReselect={onReselect} recede={nearBar} />
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
        <TaskSheet cats={cats} />
        <Wizard settings={settings} cats={cats} />
        <PlacePicker />
        {view === 'focus' && <Focus />}
        <Toast />
      </div>
    </DndContext>
  )
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
