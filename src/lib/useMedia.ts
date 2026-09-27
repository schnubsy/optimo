import { useSyncExternalStore } from 'react'

export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => matchMedia(query).matches,
    () => false,
  )
}

export const MOBILE_QUERY = '(max-width: 899px)'
export const useIsMobile = () => useMedia(MOBILE_QUERY)
// --px-per-min-mobile 1.1 → 66px/h · --px-per-min 1.2 → 72px/h (tokens.css)
export const useHourPx = () => (useIsMobile() ? 66 : 72)
