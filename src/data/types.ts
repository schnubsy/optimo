// Row shapes mirror db/001_planner.sql (docs/spec.md §5.1). Local-only fields start with `_` and never leave the device.

export type FieldTs = Record<string, number>

export interface SyncCols {
  version?: number
  updated_at?: string
  deleted_at: string | null
  field_ts: FieldTs
  device_id: string | null
}

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export type Priority = 0 | 1 | 2 | 3

export interface Task extends SyncCols {
  id: string
  title: string
  notes: string
  category_id: string | null
  priority: Priority
  start_at: string | null // ISO (UTC); null ⇒ inbox
  duration_min: number
  all_day: boolean
  completed_at: string | null
  subtasks: Subtask[]
  reminders: number[] // minutes before start
  sort_key: number
  rrule: string | null // series rows only
  dtstart: string | null
  series_id: string | null // exception-override rows only
  /** local index: 'inbox' | 'sched' | 'series' | 'override' | 'gone' */
  _kind?: TaskKind
}
export type TaskKind = 'inbox' | 'sched' | 'series' | 'override' | 'gone'

export interface Category extends SyncCols {
  id: string
  name: string
  color: CategoryColor
  icon: string
  sort_key: number
}
export const CATEGORY_COLORS = ['work', 'meet', 'health', 'personal', 'family', 'errand', 'learn', 'home'] as const
export type CategoryColor = (typeof CATEGORY_COLORS)[number]

export interface Exception extends SyncCols {
  series_id: string
  occurrence_date: string // YYYY-MM-DD
  task_id: string | null
  skipped: boolean
}

export interface SettingsData {
  theme: 'system' | 'light' | 'dark'
  day_start: number // minutes from midnight
  day_end: number
  default_duration: number
  snap: 5 | 10 | 15
  push_down: boolean
  week_start: 0 | 1 // 0 Sunday, 1 Monday
  clock24: boolean
  reminder_lead: number
  focus_min: number
}

export const DEFAULT_SETTINGS: SettingsData = {
  theme: 'system',
  day_start: 6 * 60,
  day_end: 22 * 60,
  default_duration: 30,
  snap: 5,
  push_down: false,
  week_start: 1,
  clock24: true,
  reminder_lead: 10,
  focus_min: 25,
}

/** Local settings row; the server row is keyed by user_id, locally it is always 'me'. */
export interface Settings extends SyncCols {
  id: 'me'
  data: SettingsData
}

export type TableName = 'categories' | 'tasks' | 'exceptions' | 'settings'

export const REMOTE_TABLE: Record<TableName, string> = {
  categories: 'planner_categories',
  tasks: 'planner_tasks',
  exceptions: 'planner_exceptions',
  settings: 'planner_settings',
}

export interface OutboxRow {
  seq?: number
  table: TableName
  id: string // row key ('series|date' for exceptions, 'me' for settings)
  op: 'upsert'
  payload: Record<string, unknown>
  field_ts: FieldTs
}

export interface MetaRow {
  key: string
  value: unknown
}
