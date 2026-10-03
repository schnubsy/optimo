// arc 5a slice 2 — syncCalendars() drives the shared status; calls made mid-sync coalesce into ONE follow-up run.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls: { resolve: (v: { data: unknown; error: unknown }) => void }[] = []
vi.mock('../../src/sync/remote', () => ({
  supabase: () => ({ functions: { invoke: () => new Promise((resolve) => calls.push({ resolve })) } }),
}))

const { syncCalendars } = await import('../../src/calendar/api')
const { useSyncStatus } = await import('../../src/calendar/syncStatus')
const status = () => useSyncStatus.getState().status
const tick = () => new Promise((r) => setTimeout(r, 0))
const ok = (events: number, pushed: number) => ({ data: { accounts: [{ id: 'a', events, twoWay: { pushed } }], events, pushed }, error: null })

describe('syncCalendars', () => {
  beforeEach(() => {
    calls.length = 0
    useSyncStatus.getState().reset()
  })

  it('start → syncing; the response → done with the totals', async () => {
    const p = syncCalendars()
    expect(status().kind).toBe('syncing')
    calls[0].resolve(ok(12, 1))
    await expect(p).resolves.toEqual({ events: 12, pushed: 1 })
    expect(status()).toMatchObject({ kind: 'done', events: 12, pushed: 1 })
  })

  it('calls made mid-sync queue one follow-up; the status stays syncing until it settles', async () => {
    const first = syncCalendars()
    const a = syncCalendars()
    const b = syncCalendars()
    expect(a).toBe(b)
    calls[0].resolve(ok(3, 0))
    await first
    await tick()
    expect(calls).toHaveLength(2)
    expect(status().kind).toBe('syncing')
    calls[1].resolve(ok(4, 2))
    await expect(a).resolves.toEqual({ events: 4, pushed: 2 })
    expect(status()).toMatchObject({ kind: 'done', events: 4, pushed: 2 })
  })

  it('an account error resolves but goes failed with the reason; an HTTP error throws and goes failed', async () => {
    const p = syncCalendars()
    calls[0].resolve({ data: { accounts: [{ id: 'a', error: 'No calendars found on this Apple ID' }], events: 0, pushed: 0 }, error: null })
    await p
    expect(status()).toEqual({ kind: 'failed', reason: 'No calendars found on this Apple ID.' })
    const q = syncCalendars()
    expect(status().kind).toBe('syncing')
    calls[1].resolve({ data: null, error: new Error('boom') })
    await expect(q).rejects.toThrow()
    expect(status()).toEqual({ kind: 'failed', reason: 'Couldn’t reach the calendar service — try again.' })
  })
})
