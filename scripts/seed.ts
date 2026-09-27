// Deterministic library for the perf budget (docs/spec.md §2.9): 5 000 tasks + 200 series.
// Used by tests/perf.spec.ts (bulk-loaded straight into IndexedDB) and runnable as a CLI to write an
// importable optimo export:  npx tsx scripts/seed.ts > seed.json   (Settings → Import JSON)

export interface SeedOptions {
  tasks?: number
  series?: number
  ref?: Date
}

const CATS = [
  '0190a000-0000-7000-8000-000000000001', '0190a000-0000-7000-8000-000000000002', '0190a000-0000-7000-8000-000000000003',
  '0190a000-0000-7000-8000-000000000004', '0190a000-0000-7000-8000-000000000005', '0190a000-0000-7000-8000-000000000006',
  '0190a000-0000-7000-8000-000000000007', '0190a000-0000-7000-8000-000000000008',
]
const WORDS = ['Review', 'Draft', 'Call', 'Plan', 'Fix', 'Read', 'Write', 'Email', 'Prepare', 'Book', 'Tidy', 'Check', 'Pay', 'Order', 'Sketch', 'Update']
const THINGS = ['budget', 'slides', 'garden', 'report', 'invoice', 'chapter', 'backlog', 'car service', 'tax forms', 'trip', 'notes', 'roadmap', 'kitchen', 'newsletter']
const RULES = ['FREQ=DAILY', 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', 'FREQ=WEEKLY;BYDAY=MO', 'FREQ=WEEKLY;BYDAY=WE', 'FREQ=MONTHLY;BYMONTHDAY=15']

/** Tiny deterministic PRNG so every run builds the same library. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}

export function buildSeed({ tasks = 5000, series = 200, ref = new Date() }: SeedOptions = {}) {
  const r = rng(26092026)
  const pick = <T>(a: T[]) => a[Math.floor(r() * a.length)]
  const hex = (n: number) => n.toString(16).padStart(12, '0')
  const out: Record<string, unknown>[] = []
  const base = new Date(ref)
  base.setHours(0, 0, 0, 0)
  const ts = (row: Record<string, unknown>) => Object.fromEntries(Object.keys(row).filter((k) => k !== 'id').map((k) => [k, 1]))
  for (let i = 0; i < tasks; i++) {
    const inbox = r() < 0.25
    const day = Math.floor(r() * 365) - 120 // spread over the year around today
    const start = new Date(base)
    start.setDate(start.getDate() + day)
    start.setHours(6 + Math.floor(r() * 15), [0, 15, 30, 45][Math.floor(r() * 4)])
    const row: Record<string, unknown> = {
      id: `0190c000-0000-7000-8000-${hex(i)}`,
      title: `${pick(WORDS)} ${pick(THINGS)} #${i}`,
      notes: '',
      category_id: pick(CATS),
      priority: Math.floor(r() * 4),
      start_at: inbox ? null : start.toISOString(),
      duration_min: pick([15, 30, 30, 45, 60, 90]),
      all_day: false,
      completed_at: !inbox && day < 0 && r() < 0.7 ? start.toISOString() : null,
      subtasks: [],
      reminders: [],
      sort_key: i,
      rrule: null,
      dtstart: null,
      series_id: null,
      deleted_at: null,
      device_id: null,
    }
    row.field_ts = ts(row)
    out.push(row)
  }
  for (let i = 0; i < series; i++) {
    const start = new Date(base)
    start.setDate(start.getDate() - Math.floor(r() * 60))
    start.setHours(6 + Math.floor(r() * 14), [0, 30][Math.floor(r() * 2)])
    const row: Record<string, unknown> = {
      id: `0190d000-0000-7000-8000-${hex(i)}`,
      title: `${pick(['Stretch', 'Stand-up', 'Water plants', 'Review inbox', 'Walk', 'Journal'])} ${i}`,
      notes: '',
      category_id: pick(CATS),
      priority: 0,
      start_at: start.toISOString(),
      duration_min: pick([10, 15, 30]),
      all_day: false,
      completed_at: null,
      subtasks: [],
      reminders: [],
      sort_key: i,
      rrule: pick(RULES),
      dtstart: start.toISOString(),
      series_id: null,
      deleted_at: null,
      device_id: null,
    }
    row.field_ts = ts(row)
    out.push(row)
  }
  return out
}

// CLI: emit an optimo export file
if (process.argv[1]?.endsWith('seed.ts')) {
  const tasks = buildSeed()
  process.stdout.write(JSON.stringify({ app: 'optimo', version: 1, exported_at: new Date().toISOString(), tasks, categories: [], exceptions: [], settings: [] }))
}
