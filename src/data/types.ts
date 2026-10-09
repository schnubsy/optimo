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
  /** Icon chosen for a title stem (src/quickadd/suggest.ts titleStem) — wins over the keyword map. */
  iconOverrides?: Record<string, string>
  /** IANA zone, written when push is enabled — push-send expands series in the user's wall-clock time. */
  tz?: string
  /** arc 3: the Plan tab's default mode and research switch (Settings → Planning) */
  plan_mode?: 'propose' | 'auto'
  plan_research?: boolean
  /** arc 6: the wizard's duration quick row + the Duration sheet's editable presets (minutes); unset = the defaults */
  duration_presets?: number[]
}

export const DEFAULT_DURATION_PRESETS: readonly number[] = [1, 15, 30, 45, 60, 90]
/** The duration presets in use: the saved list, or the defaults when unset/invalid. */
export function durationPresets(s: Pick<SettingsData, 'duration_presets'>): number[] {
  const p = s.duration_presets
  return Array.isArray(p) && p.every((n) => typeof n === 'number' && n > 0) ? [...p] : [...DEFAULT_DURATION_PRESETS]
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
  reminder_lead: 0, // default reminder for new timed tasks; 0 = none
  focus_min: 25,
}

/** Local settings row; the server row is keyed by user_id, locally it is always 'me'. */
export interface Settings extends SyncCols {
  id: 'me'
  data: SettingsData
}

// ---------- arc 3: AI planning (db/004_ai.sql) ----------

/** One proposed block, as the plan-day function returns it (start_at ISO/UTC on plan_date). */
export interface AiBlock {
  title: string
  start_at: string
  duration_min: number
  category_id?: string | null
  priority?: Priority | null
  why: string
}
export interface AiProposal {
  blocks: AiBlock[]
  questions: string[]
  notes: string
}
/** A web-research source shown with the plan. */
export interface AiSource {
  query: string
  url: string
  title: string
  snippet: string
}
export type AiPlanMode = 'propose' | 'auto'
export type AiPlanStatus = 'draft' | 'accepted' | 'rejected' | 'applied' | 'failed'

/** planner_ai_plans — one row per plan request (intent → proposal). */
export interface AiPlan extends SyncCols {
  id: string
  plan_date: string // YYYY-MM-DD
  intent: string
  mode: AiPlanMode
  status: AiPlanStatus
  proposal: AiProposal
  research: AiSource[]
  model: string | null
  accepted_task_ids: string[]
}

/** The learned planning style, distilled from accepted/edited plans by plan-day `learn`. */
export interface AiProfileData {
  tone?: string
  day_shape?: string
  preferred_block_min?: number
  buffers?: string
  habits?: string[]
  avoid?: string[]
}
/** planner_ai_profile — one row per user; created server-side, reset = tombstone. */
export interface AiProfile extends SyncCols {
  id: string
  data: AiProfileData
  accepted_count: number
}

export type TableName = 'categories' | 'tasks' | 'exceptions' | 'settings' | 'aiPlans' | 'aiProfile'

export const REMOTE_TABLE: Record<TableName, string> = {
  categories: 'planner_categories',
  tasks: 'planner_tasks',
  exceptions: 'planner_exceptions',
  settings: 'planner_settings',
  aiPlans: 'planner_ai_plans',
  aiProfile: 'planner_ai_profile',
}

/** Tables that exist only once db/004_ai.sql is applied — their pushes park instead of failing the sync. */
export const OPTIONAL_TABLES: ReadonlySet<TableName> = new Set(['aiPlans', 'aiProfile'])

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

/** A calendar event cached from iCloud (planner_events): server-owned, read-only on every client. */
export interface CalendarEvent {
  id: string
  account_id: string
  calendar_href: string
  uid: string
  title: string
  location: string | null
  start_at: string
  end_at: string
  all_day: boolean
  status: string | null
  color: string | null
  deleted_at: string | null
  updated_at?: string
}

/** planner_calendar_accounts_public — the secret-free view of a connected account. */
export interface CalendarAccount {
  id: string
  provider: 'icloud'
  label: string
  username: string
  calendars: { href: string; name: string; color: string | null; enabled: boolean; shared?: boolean; writable?: boolean }[]
  enabled: boolean
  last_sync_at: string | null
  last_error: string | null
  /** db/005: the calendar optimo writes timed tasks into; null = write-back off */
  write_calendar_href?: string | null
}
