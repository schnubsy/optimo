import { v7 } from 'uuid'

/** Time-ordered uuid v7 — replaying the outbox is idempotent (docs/spec.md §5.2). */
export const newId = (): string => v7()

let last = 0
/** Per-device monotonic ms clock for field_ts, so two writes in one tick still order. */
export function stamp(): number {
  const now = Date.now()
  last = now > last ? now : last + 1
  return last
}

const DEVICE_KEY = 'optimo.device'
export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = `web-${v7().slice(-12)}`
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    return 'web-ephemeral'
  }
}
