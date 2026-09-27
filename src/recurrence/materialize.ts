import type { Task } from '../data/types'

export interface Occurrence {
  task: Task
  occurrence: { seriesId: string; date: string }
}

/** Series materialisation lands in slice 5. */
export async function occurrencesInRange(_series: Task[], _fromIso: string, _toIso: string): Promise<Occurrence[]> {
  return []
}
