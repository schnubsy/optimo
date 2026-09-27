import type { TaskInput } from '../data/repo'
import type { Task } from '../data/types'

export type Scope = 'this' | 'following' | 'all'

/** Per-occurrence edits land in slice 5. */
export async function editOccurrence(_series: Task, _date: string, _patch: TaskInput, _scope: Scope): Promise<void> {}
