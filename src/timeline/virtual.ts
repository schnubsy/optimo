// Timeline virtualisation: mount only blocks inside the viewport ± one screen (docs/spec.md §2.9).

export interface Window {
  from: number // minutes
  to: number
}

export function visibleWindow(scrollTop: number, viewportH: number, hourPx: number): Window {
  if (!viewportH) return { from: 0, to: 1440 }
  const pxToMin = (px: number) => (px / hourPx) * 60
  return { from: pxToMin(scrollTop - viewportH), to: pxToMin(scrollTop + 2 * viewportH) }
}
