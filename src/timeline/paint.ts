// Paint a block (arc 5a slice 4): pure span maths for the press-drag gesture, kept free of DOM so it unit-tests.
import { MIN_PER_DAY } from '../lib/time'
import { MIN_DURATION, snap as snapTo } from './layout'

export interface PaintSpan {
  start: number
  end: number
}

/** Shortest block a paint can leave: one snap step, never under the global minimum. */
export const paintMin = (step: number) => Math.max(step, MIN_DURATION)

/**
 * The span painted from the press point `anchor` to the current point `cur` (minutes after midnight). Both ends
 * snap to the grid; dragging upward paints above the press point; the span is at least `paintMin(step)` long
 * (grown away from the anchor, in the drag direction) and is clamped to the day [0, 1440].
 */
export function paintSpan(anchor: number, cur: number, step: number, dayLen = MIN_PER_DAY): PaintSpan {
  const min = Math.min(paintMin(step), dayLen)
  const a = snapTo(anchor, step)
  const c = snapTo(cur, step)
  const down = cur >= anchor
  let start = Math.min(a, c)
  let end = Math.max(a, c)
  if (end - start < min) {
    if (down) end = start + min
    else start = end - min
  }
  if (start < 0) {
    start = 0
    end = Math.max(end, min)
  }
  if (end > dayLen) {
    end = dayLen
    start = Math.min(start, dayLen - min)
  }
  return { start, end }
}

/** Minutes after midnight for a y offset (px) inside the timeline. */
export const yToMin = (y: number, hourPx: number) => (y / hourPx) * 60
