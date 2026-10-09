// Paint a block by dragging on empty timeline (arc 5a slice 4).
//
// Gesture rules
//   mouse  — press on empty space, move ≥ 4 px vertically → painting; less than that stays a plain click
//            (click-to-create and the free-gap click are unchanged).
//   touch  — hold 400 ms without moving > 10 px (the task-drag TouchSensor threshold), then drag. Moving before the
//            hold completes is a scroll: we never preventDefault until the gesture is active.
// The ghost moves by transform only and is written straight to the DOM from a rAF loop (no React render per move);
// the commit is recomputed from the release point, never from a value a render may not have caught up with.
import { useEffect, useRef, type RefObject } from 'react'
import { fmtClock } from '../lib/time'
import { paintSpan, type PaintSpan } from './paint'
import type { SegmentMap } from './segments'

export interface PaintOpts {
  day: string
  /** the day's segment map — the only minute↔pixel conversion on the spine (arc 6 RULE) */
  map: SegmentMap
  snap: number
  clock24: boolean
  onCommit: (start: number, len: number) => void
}

/** Mouse travel (px, vertical) before a press becomes a paint — same as the task-drag MouseSensor distance. */
export const MOUSE_START_PX = 4
/** Touch hold before painting starts, and the movement that cancels it (TouchSensor delay / tolerance). */
export const TOUCH_HOLD_MS = 400
export const TOUCH_TOLERANCE_PX = 10
const EDGE_PX = 36 // auto-scroll zone at the top/bottom of the scroller
const EDGE_SPEED = 14 // px per frame at the very edge

/** Anything a press should leave alone: blocks, events, clusters, buttons, the free-gap label, the slot cursor. */
const INTERACTIVE = '.node, .evt, .gap-in, .node-handle, .tl-slot, button, a, input, select, textarea, label, [role="button"], [role="slider"], [role="dialog"], [contenteditable]'

export const rangeLabel = (s: PaintSpan, clock24: boolean) => `${fmtClock(s.start, clock24)}–${fmtClock(s.end, clock24)}`

/** The fill is laid out 100 px tall and scaled to the span's height. */
export const GHOST_FILL_PX = 100

/** Write a span into the ghost: transforms + text only (no layout properties change per frame), placed by the map. */
export function drawGhost(el: HTMLElement, s: PaintSpan, map: SegmentMap, clock24: boolean) {
  const top = map.minToY(s.start)
  const h = Math.max(2, map.minToY(s.end) - top)
  el.style.transform = `translate3d(0, ${top}px, 0)`
  const fill = el.querySelector<HTMLElement>('.paint-fill')
  const end = el.querySelector<HTMLElement>('.paint-end')
  const label = el.querySelector<HTMLElement>('.paint-label')
  if (fill) fill.style.transform = `scaleY(${h / GHOST_FILL_PX})`
  if (end) end.style.transform = `translate3d(0, ${h}px, 0)`
  if (label) {
    // update the existing text node in place (no node churn per frame)
    const text = rangeLabel(s, clock24)
    if (label.firstChild?.nodeType === Node.TEXT_NODE) label.firstChild.nodeValue = text
    else label.textContent = text
  }
  el.dataset.start = String(s.start)
  el.dataset.len = String(s.end - s.start)
}
export function showGhost(el: HTMLElement) {
  el.dataset.on = ''
}
export function hideGhost(el: HTMLElement) {
  delete el.dataset.on
}

interface Gesture {
  id: number
  touch: boolean
  x0: number
  y0: number
  anchor: number // minutes
  y: number // last clientY
  active: boolean
  timer: number
  raf: number
  last: string
}

export function usePaint(innerRef: RefObject<HTMLElement | null>, scrollRef: RefObject<HTMLElement | null>, ghostRef: RefObject<HTMLElement | null>, opts: PaintOpts) {
  const o = useRef(opts)
  useEffect(() => {
    o.current = opts
  })

  useEffect(() => {
    const el = innerRef.current
    if (!el) return
    let g: Gesture | null = null
    let suppressClick = false

    const minAt = (clientY: number) => o.current.map.yToMin(clientY - el.getBoundingClientRect().top)
    const spanAt = (clientY: number) => paintSpan(g!.anchor, minAt(clientY), o.current.snap)

    const preventTouch = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault()
    }
    const preventMenu = (e: Event) => {
      if (g?.touch) e.preventDefault()
    }

    function frame() {
      if (!g?.active) return
      // auto-scroll near the scroller's top/bottom edge so a long block can be painted past the viewport
      const sc = scrollRef.current
      if (sc) {
        const r = sc.getBoundingClientRect()
        const up = g.y - r.top
        const down = r.bottom - g.y
        if (up < EDGE_PX) sc.scrollTop -= Math.ceil(EDGE_SPEED * (1 - Math.max(0, up) / EDGE_PX))
        else if (down < EDGE_PX) sc.scrollTop += Math.ceil(EDGE_SPEED * (1 - Math.max(0, down) / EDGE_PX))
      }
      const s = spanAt(g.y)
      const key = `${s.start}:${s.end}`
      const ghost = ghostRef.current
      if (ghost && key !== g.last) {
        g.last = key
        drawGhost(ghost, s, o.current.map, o.current.clock24)
      }
      g.raf = requestAnimationFrame(frame)
    }

    function activate() {
      if (!g || g.active) return
      g.active = true
      clearTimeout(g.timer)
      try {
        el!.setPointerCapture(g.id)
      } catch {
        /* the pointer is already gone */
      }
      // from here on the gesture owns the finger: no scroll, no long-press menu
      if (g.touch) window.addEventListener('touchmove', preventTouch, { passive: false })
      el!.classList.add('painting')
      const ghost = ghostRef.current
      if (ghost) {
        g.last = ''
        const s = spanAt(g.y)
        drawGhost(ghost, s, o.current.map, o.current.clock24)
        g.last = `${s.start}:${s.end}`
        showGhost(ghost)
      }
      g.raf = requestAnimationFrame(frame)
    }

    function end(commitY: number | null) {
      const cur = g
      if (!cur) return
      g = null
      clearTimeout(cur.timer)
      cancelAnimationFrame(cur.raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('touchmove', preventTouch)
      el!.classList.remove('painting')
      if (ghostRef.current) hideGhost(ghostRef.current)
      if (!cur.active) return
      try {
        el!.releasePointerCapture(cur.id)
      } catch {
        /* already released */
      }
      // the click that follows a mouse release must not also run click-to-create
      suppressClick = true
      window.setTimeout(() => (suppressClick = false), 0)
      if (commitY === null) return
      const s = paintSpan(cur.anchor, minAt(commitY), o.current.snap)
      o.current.onCommit(s.start, s.end - s.start)
    }

    function onDown(e: PointerEvent) {
      if (g || !e.isPrimary) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      const t = e.target as Element | null
      if (!t || (t !== el && t.closest(INTERACTIVE))) return
      const touch = e.pointerType !== 'mouse'
      g = { id: e.pointerId, touch, x0: e.clientX, y0: e.clientY, y: e.clientY, anchor: minAt(e.clientY), active: false, timer: 0, raf: 0, last: '' }
      if (touch) g.timer = window.setTimeout(activate, TOUCH_HOLD_MS)
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onCancel)
      window.addEventListener('keydown', onKey, true)
    }
    function onMove(e: PointerEvent) {
      if (!g || e.pointerId !== g.id) return
      g.y = e.clientY
      if (g.active) return // the rAF loop draws
      const dx = e.clientX - g.x0
      const dy = e.clientY - g.y0
      if (g.touch) {
        // moved before the hold completed: it is a scroll, not a paint
        if (Math.hypot(dx, dy) > TOUCH_TOLERANCE_PX) end(null)
      } else if (Math.abs(dy) >= MOUSE_START_PX) activate()
    }
    function onUp(e: PointerEvent) {
      if (!g || e.pointerId !== g.id) return
      end(e.clientY)
    }
    function onCancel(e: PointerEvent) {
      if (!g || e.pointerId !== g.id) return
      end(null)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape' || !g?.active) return
      e.preventDefault()
      e.stopPropagation()
      end(null)
    }
    function onClick(e: MouseEvent) {
      if (!suppressClick) return
      suppressClick = false
      e.stopPropagation()
      e.preventDefault()
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('click', onClick, true)
    el.addEventListener('contextmenu', preventMenu)
    return () => {
      end(null)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('click', onClick, true)
      el.removeEventListener('contextmenu', preventMenu)
    }
  }, [innerRef, scrollRef, ghostRef])
}
