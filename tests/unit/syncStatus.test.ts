// arc 5a slice 2 — the shared calendar sync status: every transition, the 4 s auto-clear, and the plain-copy reasons.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DONE_CLEAR_MS, IDLE, doneText, reasonFor, reduce, useSyncStatus, type SyncStatus } from '../../src/calendar/syncStatus'
import { totalsOf } from '../../src/calendar/api'

const syncing: SyncStatus = { kind: 'syncing' }
const done: SyncStatus = { kind: 'done', events: 3, pushed: 1, at: 100 }
const failed: SyncStatus = { kind: 'failed', reason: 'Nope.' }

describe('reduce', () => {
  it('idle → syncing on start', () => expect(reduce(IDLE, { type: 'start' })).toEqual(syncing))
  it('a start while syncing is ignored (same object)', () => expect(reduce(syncing, { type: 'start' })).toBe(syncing))
  it('syncing → done{events,pushed,at}', () => expect(reduce(syncing, { type: 'done', events: 3, pushed: 1, at: 100 })).toEqual(done))
  it('syncing → failed{reason}', () => expect(reduce(syncing, { type: 'fail', reason: 'Nope.' })).toEqual(failed))
  it('failed → syncing on retry (start)', () => expect(reduce(failed, { type: 'start' })).toEqual(syncing))
  it('done → syncing on a new start', () => expect(reduce(done, { type: 'start' })).toEqual(syncing))
  it('a done outside a run is ignored', () => {
    expect(reduce(IDLE, { type: 'done', events: 1, pushed: 0, at: 1 })).toBe(IDLE)
    expect(reduce(failed, { type: 'done', events: 1, pushed: 0, at: 1 })).toBe(failed)
  })
  it('a failure outside a run still shows (e.g. listing accounts)', () => expect(reduce(IDLE, { type: 'fail', reason: 'x' })).toEqual({ kind: 'failed', reason: 'x' }))
  it('clear only clears the done it was scheduled for', () => {
    expect(reduce(done, { type: 'clear', at: 100 })).toBe(IDLE)
    expect(reduce(done, { type: 'clear', at: 99 })).toBe(done)
    expect(reduce(syncing, { type: 'clear', at: 100 })).toBe(syncing)
    expect(reduce(failed, { type: 'clear', at: 100 })).toBe(failed)
  })
})

describe('store', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useSyncStatus.getState().reset()
  })
  afterEach(() => vi.useRealTimers())
  const s = () => useSyncStatus.getState().status

  it('done auto-clears to idle after 4000 ms', () => {
    useSyncStatus.getState().start()
    useSyncStatus.getState().done({ events: 12, pushed: 2 })
    expect(s()).toMatchObject({ kind: 'done', events: 12, pushed: 2 })
    vi.advanceTimersByTime(DONE_CLEAR_MS - 1)
    expect(s().kind).toBe('done')
    vi.advanceTimersByTime(1)
    expect(s()).toEqual(IDLE)
  })

  it('a new sync during the 4 s is not cleared by the old timer', () => {
    useSyncStatus.getState().start()
    useSyncStatus.getState().done({ events: 1, pushed: 0 })
    vi.advanceTimersByTime(2000)
    useSyncStatus.getState().start()
    vi.advanceTimersByTime(DONE_CLEAR_MS)
    expect(s().kind).toBe('syncing')
  })

  it('failed stays until a retry, which goes back to syncing', () => {
    useSyncStatus.getState().start()
    useSyncStatus.getState().fail(new Error('NO_CALENDARS'))
    vi.advanceTimersByTime(60_000)
    expect(s()).toEqual({ kind: 'failed', reason: 'No calendars found on this Apple ID.' })
    useSyncStatus.getState().start()
    expect(s().kind).toBe('syncing')
  })
})

describe('reasonFor', () => {
  it.each([
    ['NO_CALENDARS', 'No calendars found on this Apple ID.'],
    ['No calendars found on this Apple ID', 'No calendars found on this Apple ID.'],
    ['not_connected', 'Calendar sync isn’t set up on the server yet.'],
    [new TypeError('Failed to fetch'), 'Couldn’t reach the calendar service — check your connection and try again.'],
    [Object.assign(new Error('Failed to send a request to the Edge Function'), { name: 'FunctionsFetchError' }), 'Couldn’t reach the calendar service — check your connection and try again.'],
    [new Error('iCloud rejected the app-specific password — reconnect in Settings.'), 'iCloud rejected the app-specific password — reconnect in Settings.'],
    [new Error('Sync failed: boom'), 'Sync failed: boom.'],
    [undefined, 'Calendar sync failed — try again.'],
  ])('%s → %s', (err, want) => expect(reasonFor(err)).toBe(want))
})

describe('copy + totals', () => {
  it('singular / plural', () => {
    expect(doneText(1, 1)).toBe('Synced · 1 event · 1 sent to iCloud')
    expect(doneText(12, 0)).toBe('Synced · 12 events · 0 sent to iCloud')
  })
  it('reads the top-level totals, or sums accounts[] from an older server', () => {
    expect(totalsOf({ accounts: [], events: 4, pushed: 2 })).toEqual({ events: 4, pushed: 2 })
    expect(totalsOf({ accounts: [{ events: 3, twoWay: { pushed: 1 } }, { events: 2 }, { error: 'x' }] })).toEqual({ events: 5, pushed: 1 })
    expect(totalsOf(null)).toEqual({ events: 0, pushed: 0 })
  })
})
