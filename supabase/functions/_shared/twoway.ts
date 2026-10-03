// arc 4 — two-way iCloud sync for one account, run by calendar-sync after the event pull.
//   pull back: optimo objects edited in iCloud (etag ≠ link.etag) move / rename the task; gone from the write
//              calendar → the task is tombstoned. Writes are upserts with field_ts = now and device_id
//              `calendar-sync`, so planner_merge() arbitrates them like any client's.
//   push:      every scheduled, non-recurring, non-deleted task (start ≥ now−7d) whose version > link.pushed_version is
//              PUT into the chosen calendar (If-Match / If-None-Match: *); deleted / unscheduled → DELETE; a new
//              write target → move. A 412 means iCloud changed it first: that edit is applied, never overwritten.
//   echo guard: a task written by the pull gets pushed_version = its merged version, so it is not pushed back.
// Recurring tasks are not written this arc (docs/spec.md §3).
import { CalDavConflict, type CalDav } from './caldav.ts'
import type { AccountRow } from './handlers.ts'
import { icsToFields, objectName, taskToIcs, uidFor } from './vevent.ts'

export interface TaskRow {
  id: string
  user_id: string
  title: string
  start_at: string | null
  duration_min: number
  all_day: boolean
  rrule: string | null
  series_id: string | null
  deleted_at: string | null
  version: number
}
export interface LinkRow {
  task_id: string
  user_id: string
  account_id: string
  calendar_href: string
  object_href: string
  uid: string
  etag: string | null
  pushed_version: number
}
/** An optimo-owned object seen in a calendar-query REPORT (never cached as a planner_event). */
export interface SeenObject {
  calendar: string
  href: string
  etag: string | null
  ics: string
}

/** What two-way sync needs from the platform (service-role access to planner_tasks + planner_calendar_links). */
export interface TwoWayPorts {
  /** scheduled, non-recurring, non-override, live tasks with start_at ≥ fromIso */
  tasksForPush(userId: string, fromIso: string): Promise<TaskRow[]>
  /** tasks by id in any state (linked tasks may since be deleted or unscheduled) */
  tasksByIds(userId: string, ids: string[]): Promise<TaskRow[]>
  links(accountId: string): Promise<LinkRow[]>
  upsertLink(row: LinkRow): Promise<void>
  deleteLink(taskId: string): Promise<void>
  /** Upsert `fields` onto task `id` as device `calendar-sync`, each field stamped `ts` (ms) → the merged version. */
  writeTask(userId: string, id: string, fields: Record<string, unknown>, ts: number): Promise<number>
  /** the user's IANA zone (planner_settings.data.tz), for all-day dates */
  userTz(userId: string): Promise<string>
}

export interface TwoWayResult {
  pushed: number
  deleted: number
  moved: number
  pulledBack: number
  tombstoned: number
  conflicts: number
}
export const NO_TWO_WAY: TwoWayResult = { pushed: 0, deleted: 0, moved: 0, pulledBack: 0, tombstoned: 0, conflicts: 0 }

/** A task optimo writes to iCloud (ignoring the time window). */
const writable = (t: TaskRow) => !t.deleted_at && !!t.start_at && !t.rrule && !t.series_id

export async function twoWay(dav: CalDav, acc: AccountRow, p: TwoWayPorts, seen: Map<string, SeenObject>, from: Date, now: Date): Promise<TwoWayResult> {
  const target = acc.write_calendar_href
  if (!target) return { ...NO_TWO_WAY } // write-back off: optimo leaves iCloud (and what it wrote there) alone
  const r = { ...NO_TWO_WAY }
  const tz = await p.userTz(acc.user_id)
  const ts = now.getTime()
  const links = new Map((await p.links(acc.id)).map((l) => [l.task_id, l]))
  const tasks = new Map((await p.tasksByIds(acc.user_id, [...links.keys()])).map((t) => [t.id, t]))

  /** iCloud's version of a linked object wins for start / length / title (field_ts now); returns false if it's gone. */
  const applyFromICloud = async (link: LinkRow, task: TaskRow, obj: { etag: string | null; ics: string | null }): Promise<void> => {
    if (!obj.ics) {
      // deleted in iCloud (or moved out of the write calendar) → the task goes too, as a tombstone like any delete
      await p.writeTask(acc.user_id, task.id, { deleted_at: now.toISOString() }, ts)
      task.deleted_at = now.toISOString()
      await p.deleteLink(task.id)
      links.delete(task.id)
      r.tombstoned++
      return
    }
    const f = icsToFields(obj.ics, tz)
    const fields: Record<string, unknown> = {}
    if (f) {
      if (f.title !== task.title) fields.title = f.title
      if (Date.parse(f.start_at) !== Date.parse(task.start_at ?? '')) fields.start_at = f.start_at
      if (f.all_day !== task.all_day) fields.all_day = f.all_day
      if (!f.all_day && f.duration_min !== task.duration_min) fields.duration_min = f.duration_min
    }
    let pushed = link.pushed_version
    if (Object.keys(fields).length) {
      const version = await p.writeTask(acc.user_id, task.id, fields, ts)
      Object.assign(task, fields, { version })
      pushed = version // echo guard: what iCloud holds IS this version
      r.pulledBack++
    }
    const next = { ...link, etag: obj.etag, pushed_version: pushed }
    await p.upsertLink(next)
    links.set(task.id, next)
  }

  // ---- pull back: every linked, still-writable task whose object is in (or due back from) the window ----
  const unseen = new Map<string, LinkRow[]>() // calendar → links not in the REPORT
  for (const link of [...links.values()]) {
    const task = tasks.get(link.task_id)
    if (!task) {
      // the task row was purged: drop optimo's copy in iCloud too
      await dav.remove(link.object_href).catch(() => undefined)
      await p.deleteLink(link.task_id)
      links.delete(link.task_id)
      continue
    }
    if (!writable(task) || link.calendar_href !== target) continue // the push phase deletes / moves these
    const obj = seen.get(link.uid)
    if (obj && obj.calendar === link.calendar_href) {
      if (obj.etag !== link.etag) await applyFromICloud(link, task, obj)
    } else if (Date.parse(task.start_at!) >= from.getTime()) {
      // not in the REPORT window (moved far out in iCloud, or deleted): ask for the object itself
      unseen.set(link.calendar_href, [...(unseen.get(link.calendar_href) ?? []), link])
    }
  }
  for (const [cal, ls] of unseen) {
    const got = await dav.multiget(cal, ls.map((l) => l.object_href))
    for (const [i, link] of ls.entries()) {
      const o = got[i]
      if (o.ics && o.etag === link.etag) continue
      await applyFromICloud(link, tasks.get(link.task_id)!, o)
    }
  }

  // ---- push ----
  const candidates = await p.tasksForPush(acc.user_id, from.toISOString())
  const wanted = new Set(candidates.map((t) => t.id))
  for (const t of candidates) {
    let link = links.get(t.id)
    if (link && link.calendar_href !== target) {
      // the write target changed: move = DELETE from the old calendar, PUT into the new one
      await dav.remove(link.object_href, link.etag).catch((e) => (e instanceof CalDavConflict ? dav.remove(link!.object_href) : Promise.reject(e)))
      await p.deleteLink(t.id)
      links.delete(t.id)
      link = undefined
      r.moved++
    }
    const ics = taskToIcs({ id: t.id, title: t.title, start_at: t.start_at!, duration_min: t.duration_min, all_day: t.all_day }, tz, now)
    if (!link) {
      const href = new URL(objectName(t.id), target.endsWith('/') ? target : `${target}/`).toString()
      let etag: string | null
      try {
        etag = await dav.put(href, ics, { create: true })
      } catch (e) {
        if (!(e instanceof CalDavConflict)) throw e
        // an object with this name already exists (a lost link, or a concurrent sync): update it in place
        const [cur] = await dav.multiget(target, [href])
        etag = await dav.put(href, ics, cur.etag ? { etag: cur.etag } : {})
      }
      etag ??= (await dav.multiget(target, [href]))[0].etag
      const next = { task_id: t.id, user_id: acc.user_id, account_id: acc.id, calendar_href: target, object_href: href, uid: uidFor(t.id), etag, pushed_version: t.version }
      await p.upsertLink(next)
      links.set(t.id, next)
      r.pushed++
      continue
    }
    if (t.version <= link.pushed_version) continue
    try {
      const etag = (await dav.put(link.object_href, ics, { etag: link.etag })) ?? (await dav.multiget(target, [link.object_href]))[0].etag
      const next = { ...link, etag, pushed_version: t.version }
      await p.upsertLink(next)
      links.set(t.id, next)
      r.pushed++
    } catch (e) {
      if (!(e instanceof CalDavConflict)) throw e
      // 412: someone edited (or deleted) it in iCloud since our last look — that edit wins; nothing is overwritten
      r.conflicts++
      const [cur] = await dav.multiget(target, [link.object_href])
      await applyFromICloud(link, t, cur)
    }
  }
  // linked tasks that are no longer written: deleted, unscheduled, made recurring → remove optimo's object.
  // (A task that merely aged out of the window keeps its event.)
  for (const link of [...links.values()]) {
    if (wanted.has(link.task_id)) continue
    const task = tasks.get(link.task_id)
    if (task && writable(task)) continue
    await dav.remove(link.object_href, link.etag).catch((e) => (e instanceof CalDavConflict ? dav.remove(link.object_href) : Promise.reject(e)))
    await p.deleteLink(link.task_id)
    links.delete(link.task_id)
    r.deleted++
  }
  return r
}
