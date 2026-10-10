// The iPhone day panel as a two-detent bottom sheet (arc 6 slice 4, mockups 01 / 10).
//   EXPANDED ('day')  — top at the header's bottom edge, 7 px side margins, square bottom (the current look)
//   COLLAPSED ('week') — a 112 px peek (grabber + first row), 20 px side margins, all corners round, 8 px above the
//                        tab bar; the week overview shows behind it
// Motion is transform-only (translateY) plus a clip-path inset for the narrower, shorter peek — no layout property
// changes per frame. A drag on the grabber / the panel's top 56 px (anywhere on the peek when collapsed) follows the
// finger; release snaps with --ease-drawer: a flick faster than 0.3 px/ms picks the detent in its direction, else the
// nearest one. The live value lives in refs and the commit is recomputed from the release (lessons 2026-09-27 [dnd]).
import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { useUI, type PanelDetent } from '../state/ui'
import './panel.css'

/** The collapsed peek: grabber + the first row. */
export const PEEK_PX = 112
/** Gap between the peek and the tab bar. */
const PEEK_GAP = 8
/** Collapsed side margin (screen edge → sheet); the expanded sheet keeps --panel-margin (7 px). */
const PEEK_MARGIN = 20
const EXPANDED_MARGIN = 7
/** The draggable band at the top of the expanded sheet. */
export const HANDLE_PX = 56
/** Flick speed (px/ms) above which the release picks the detent in the flick's direction. */
export const FLICK_V = 0.3
/** Vertical travel before a press becomes a sheet drag. */
const START_PX = 6
const RADIUS = 28
/** Presses here keep their own behaviour (chips drag tasks, rings complete, text opens the editor). */
const OWN = 'button:not([data-grabber]), a, input, select, textarea, [role="slider"], .node-chip, .ring, .node-handle'

/**
 * The peek shows the day's first row: its top, less a little air, in the timeline's scroll coordinates. The all-day
 * strip sits above `.tl-inner` (so `inner.offsetTop` already counts it); if it is still sticky it would cover the top
 * of the peek, so the row is scrolled below it (panel.css makes it static in the peek, which leaves this at 0).
 */
function firstRowTop(tl: HTMLElement): number {
  const inner = tl.querySelector<HTMLElement>('.tl-inner')
  let top = Infinity
  tl.querySelectorAll<HTMLElement>('.tl-inner > .node').forEach((n) => (top = Math.min(top, n.offsetTop)))
  const strip = tl.querySelector<HTMLElement>('.allday')
  const sticky = strip && getComputedStyle(strip).position === 'sticky' ? strip.offsetHeight : 0
  return Number.isFinite(top) ? Math.max(0, top + (inner?.offsetTop ?? 0) - 18 - sticky) : 0
}

/**
 * Turn the snap transition on / off. WebKit only starts a transition when `transition` was already set in the style
 * the change starts from, so turning it on commits a style flush before the caller writes the new position.
 */
function motion(el: HTMLElement, on: boolean) {
  el.style.transition = on ? '' : 'none'
  if (on) void getComputedStyle(el).transform
}

interface Gesture {
  id: number
  y0: number
  ty0: number
  ty: number
  active: boolean
  samples: { t: number; y: number }[]
}

export function PanelSheet({ children, onMotion }: { children: ReactNode; onMotion?: (moving: boolean) => void }) {
  const panel = useUI((s) => s.panel)
  const date = useUI((s) => s.date)
  const ref = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef(panel)
  const motionRef = useRef(onMotion)
  useEffect(() => {
    motionRef.current = onMotion
  })

  /** translateY of the collapsed detent, from the live geometry (resize / safe-area safe). */
  const collapsedY = useCallback(() => {
    const el = ref.current
    if (!el) return 0
    const top = el.offsetTop
    const bar = document.querySelector('[data-testid="tabbar"]')?.getBoundingClientRect()
    const barTop = bar && bar.height ? bar.top : window.innerHeight - 76
    return Math.max(0, barTop - PEEK_GAP - PEEK_PX - top)
  }, [])

  /** Write a position: p = 0 expanded … 1 collapsed. */
  const paint = useCallback((ty: number, max: number) => {
    const el = ref.current
    if (!el) return
    const p = max ? Math.min(1, Math.max(0, ty / max)) : 0
    const side = (PEEK_MARGIN - EXPANDED_MARGIN) * p
    const bottom = Math.max(0, el.offsetHeight - PEEK_PX) * p
    const br = RADIUS * p
    el.style.transform = ty ? `translate3d(0, ${ty}px, 0)` : 'none'
    el.style.clipPath = `inset(0px ${side}px ${bottom}px ${side}px round ${RADIUS}px ${RADIUS}px ${br}px ${br}px)`
  }, [])

  /** Settled and expanded: drop the clip so nothing inside (popovers, focus rings) is cut by it. */
  const unclip = useCallback(() => {
    const el = ref.current
    if (el && panelRef.current === 'day' && el.dataset.dragging === undefined) el.style.clipPath = 'none'
  }, [])

  // detent changes (tab re-tap, column tap, drag release, deep link) animate; the first paint and resizes do not
  const first = useRef(true)
  const scrollMemo = useRef<{ date: string; top: number } | null>(null)
  const settleTimer = useRef(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const prev = panelRef.current
    panelRef.current = panel
    const animate = !first.current && prev !== panel
    first.current = false
    // clip-path only interpolates inset → inset: give a settled (unclipped) sheet its expanded inset first
    if (animate && (!el.style.clipPath || el.style.clipPath === 'none')) {
      motion(el, false)
      paint(0, collapsedY())
    }
    motion(el, animate)
    const tl = el.querySelector<HTMLElement>('.tl')
    if (panel === 'week' && tl) {
      // the peek shows the day's first row; remember where the day was so expanding returns there
      scrollMemo.current = { date: useUI.getState().date, top: tl.scrollTop }
    }
    paint(panel === 'week' ? collapsedY() : 0, collapsedY())
    bodyRef.current?.toggleAttribute('inert', panel === 'week')
    el.dataset.detent = panel
    window.clearTimeout(settleTimer.current)
    const done = () => {
      el.removeEventListener('transitionend', onEnd)
      window.clearTimeout(settleTimer.current)
      if (panelRef.current === 'week' && tl) tl.scrollTop = firstRowTop(tl)
      unclip()
      motionRef.current?.(false)
    }
    const onEnd = (e: TransitionEvent) => {
      if (e.target === el && e.propertyName === 'transform') done()
    }
    // reduced motion (base.css keeps no transform transitions): the change is instant — settle now
    if (animate && el.getAnimations().length) {
      motionRef.current?.(true)
      el.addEventListener('transitionend', onEnd)
      // transitionend never fires when nothing moved (or the tab is hidden): settle anyway
      settleTimer.current = window.setTimeout(done, 700)
    } else done()
    if (panel === 'day' && tl && scrollMemo.current && scrollMemo.current.date === useUI.getState().date) tl.scrollTop = scrollMemo.current.top
    if (panel === 'day') scrollMemo.current = null
    return () => el.removeEventListener('transitionend', onEnd)
  }, [panel, paint, collapsedY, unclip])

  // a new day while collapsed starts at the top of the peek
  useEffect(() => {
    if (panelRef.current !== 'week') return
    const tl = ref.current?.querySelector<HTMLElement>('.tl')
    if (tl) requestAnimationFrame(() => requestAnimationFrame(() => (tl.scrollTop = firstRowTop(tl))))
  }, [date])

  useEffect(() => {
    const onResize = () => {
      const el = ref.current
      if (!el) return
      motion(el, false)
      paint(panelRef.current === 'week' ? collapsedY() : 0, collapsedY())
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [paint, collapsedY])

  // ---------- the drag ----------
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let g: Gesture | null = null
    let swallowClick = false

    function onDown(e: PointerEvent) {
      if (e.button !== 0 || g) return
      const target = e.target as HTMLElement
      const collapsed = panelRef.current === 'week'
      const local = e.clientY - el!.getBoundingClientRect().top
      if (!collapsed && local > HANDLE_PX) return
      if (!collapsed && target.closest(OWN)) return
      // the press belongs to the sheet: keep it from starting a paint gesture underneath
      e.stopPropagation()
      const max = collapsedY()
      const ty0 = collapsed ? max : 0
      g = { id: e.pointerId, y0: e.clientY, ty0, ty: ty0, active: false, samples: [{ t: e.timeStamp, y: e.clientY }] }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    }
    function onMove(e: PointerEvent) {
      if (!g || e.pointerId !== g.id) return
      const dy = e.clientY - g.y0
      if (!g.active) {
        if (Math.abs(dy) < START_PX) return
        g.active = true
        motion(el!, false)
        paint(g.ty0, collapsedY())
        el!.dataset.dragging = ''
        motionRef.current?.(true)
      }
      const max = collapsedY()
      g.ty = Math.min(max, Math.max(0, g.ty0 + dy))
      g.samples.push({ t: e.timeStamp, y: e.clientY })
      if (g.samples.length > 8) g.samples.shift()
      paint(g.ty, max)
    }
    function onUp(e: PointerEvent) {
      if (!g || e.pointerId !== g.id) return
      const gesture = g
      g = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      if (!gesture.active) return
      delete el!.dataset.dragging
      swallowClick = true
      setTimeout(() => (swallowClick = false), 0)
      const max = collapsedY()
      // recompute from the release point, not from the last painted move
      const ty = e.type === 'pointercancel' ? gesture.ty : Math.min(max, Math.max(0, gesture.ty0 + e.clientY - gesture.y0))
      const recent = gesture.samples.filter((s) => e.timeStamp - s.t <= 100)
      const s0 = recent[0] ?? gesture.samples[0]
      const dt = e.timeStamp - s0.t
      const v = dt > 0 ? (e.clientY - s0.y) / dt : 0
      const next: PanelDetent = Math.abs(v) > FLICK_V ? (v > 0 ? 'week' : 'day') : ty > max / 2 ? 'week' : 'day'
      motion(el!, true)
      if (next === panelRef.current) {
        paint(next === 'week' ? max : 0, max)
        let once = false
        const settle = () => {
          if (once) return
          once = true
          unclip()
          motionRef.current?.(next === 'week')
        }
        if (!el!.getAnimations().length) settle()
        el!.addEventListener('transitionend', settle, { once: true })
        window.setTimeout(settle, 700)
      } else useUI.getState().set({ panel: next })
    }
    // a drag that ends over a button must not also click it
    function onClick(e: MouseEvent) {
      if (!swallowClick) return
      swallowClick = false
      e.stopPropagation()
      e.preventDefault()
    }
    // iOS: keep the page / timeline from panning while the sheet follows the finger
    function onTouchMove(e: TouchEvent) {
      if (g && e.cancelable) e.preventDefault()
    }
    el.addEventListener('pointerdown', onDown, true)
    el.addEventListener('click', onClick, true)
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', onDown, true)
      el.removeEventListener('click', onClick, true)
      el.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [paint, collapsedY, unclip])

  const toggle = () => useUI.getState().set({ panel: panelRef.current === 'week' ? 'day' : 'week' })
  const collapsed = panel === 'week'
  return (
    <div className="psheet" ref={ref} data-testid="panel-sheet" data-detent={panel}>
      <button
        type="button"
        className="psheet-grab"
        data-grabber=""
        aria-label={collapsed ? 'Expand the day panel' : 'Collapse to the week overview'}
        aria-expanded={!collapsed}
        onClick={toggle}
        data-testid="panel-grabber"
      >
        <i aria-hidden="true" />
      </button>
      {/* the whole peek is a handle: tap expands, drag follows (the grabber button is the keyboard / AT control) */}
      {collapsed && <div className="psheet-peek" data-grabber="" aria-hidden="true" onClick={toggle} data-testid="panel-peek" />}
      <div className="psheet-body" ref={bodyRef}>
        {children}
      </div>
    </div>
  )
}
