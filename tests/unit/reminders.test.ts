import { describe, expect, it } from 'vitest'
import { dueReminders } from '../../src/reminders/scheduler'

const at = (h: number, m = 0) => new Date(2026, 8, 26, h, m).getTime()
const item = (key: string, h: number, reminders: number[], completed_at: string | null = null) => ({
  key,
  task: { title: key, start_at: new Date(at(h)).toISOString(), reminders, completed_at },
})

describe('dueReminders', () => {
  it('fires each offset once inside (lastCheck, now]', () => {
    const items = [item('a', 10, [0, 10]), item('b', 11, [5])]
    expect(dueReminders(items, at(9, 49), at(9, 50)).map((r) => r.id)).toEqual(['a:10'])
    expect(dueReminders(items, at(9, 50), at(10, 0)).map((r) => r.id)).toEqual(['a:0'])
    expect(dueReminders(items, at(10, 0), at(10, 54)).map((r) => r.id)).toEqual([])
    expect(dueReminders(items, at(10, 54), at(10, 55)).map((r) => r.id)).toEqual(['b:5'])
  })
  it('skips completed and unscheduled tasks', () => {
    expect(dueReminders([item('c', 10, [0], 'done')], at(9), at(11))).toEqual([])
    expect(dueReminders([{ key: 'd', task: { title: 'd', start_at: null, reminders: [0], completed_at: null } }], at(9), at(11))).toEqual([])
  })
})
