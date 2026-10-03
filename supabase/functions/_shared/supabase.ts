// Deno-side ports: service-role supabase-js against press. Only Edge Functions hold the service role key.
import { createClient } from '@supabase/supabase-js'
import type { AccountRow, EventRow, Ports } from './handlers.ts'
import { eventKey } from './handlers.ts'
import type { LinkRow, TaskRow } from './twoway.ts'

const TASK_COLS = 'id,user_id,title,start_at,duration_min,all_day,rrule,series_id,deleted_at,version'
const PAGE = 1000 // PostgREST's default max rows per response

export function denoPorts(): Ports {
  const env = (k: string) => Deno.env.get(k) ?? ''
  const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
  const must = <T>(r: { data: T; error: { message: string } | null }) => {
    if (r.error) throw new Error(r.error.message)
    return r.data
  }
  return {
    kek: env('PLANNER_KEK'),
    cronSecret: env('CRON_SECRET'),
    fetch: (u, i) => fetch(u, i),
    newId: () => crypto.randomUUID(),
    log: (m) => console.log(m),
    async userFromJwt(jwt) {
      if (!jwt) return null
      const { data } = await sb.auth.getUser(jwt)
      return data.user?.id ?? null
    },
    async insertAccount(row: AccountRow) {
      must(await sb.from('planner_calendar_accounts').insert(row))
    },
    async accounts(userId) {
      let q = sb.from('planner_calendar_accounts').select('*')
      if (userId) q = q.eq('user_id', userId)
      return must(await q) as AccountRow[]
    },
    async updateAccount(id, patch) {
      must(await sb.from('planner_calendar_accounts').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id))
    },
    async eventKeys(accountId) {
      const rows = must(await sb.from('planner_events').select('calendar_href,uid,etag,start_at,end_at,title').eq('account_id', accountId).is('deleted_at', null)) as EventRow[]
      return new Map(rows.map((r) => [eventKey(r.calendar_href, r.uid), `${r.etag}|${new Date(r.start_at).toISOString()}|${new Date(r.end_at).toISOString()}|${r.title}`]))
    },
    async upsertEvents(rows) {
      for (let i = 0; i < rows.length; i += 200)
        must(await sb.from('planner_events').upsert(rows.slice(i, i + 200).map((r) => ({ ...r, updated_at: new Date().toISOString() })), { onConflict: 'account_id,calendar_href,uid' }))
    },
    async tombstoneEvents(accountId, keys) {
      const now = new Date().toISOString()
      for (const k of keys) {
        const [href, uid] = k.split('\u0000')
        must(await sb.from('planner_events').update({ deleted_at: now, updated_at: now }).eq('account_id', accountId).eq('calendar_href', href).eq('uid', uid))
      }
    },
    // ---- two-way (arc 4): planner_tasks writes go through upsert + field_ts, so planner_merge() arbitrates them ----
    async tasksForPush(userId, fromIso) {
      const out: TaskRow[] = []
      for (let off = 0; ; off += PAGE) {
        const rows = must(
          await sb.from('planner_tasks').select(TASK_COLS).eq('user_id', userId).gte('start_at', fromIso).is('rrule', null).is('series_id', null).is('deleted_at', null).order('id').range(off, off + PAGE - 1),
        ) as TaskRow[]
        out.push(...rows)
        if (rows.length < PAGE) return out
      }
    },
    async tasksByIds(userId, ids) {
      const out: TaskRow[] = []
      for (let i = 0; i < ids.length; i += 200) out.push(...(must(await sb.from('planner_tasks').select(TASK_COLS).eq('user_id', userId).in('id', ids.slice(i, i + 200))) as TaskRow[]))
      return out
    },
    async links(accountId) {
      return must(await sb.from('planner_calendar_links').select('*').eq('account_id', accountId)) as LinkRow[]
    },
    async upsertLink(row) {
      must(await sb.from('planner_calendar_links').upsert({ ...row, pushed_at: new Date().toISOString() }, { onConflict: 'task_id' }))
    },
    async deleteLink(taskId) {
      must(await sb.from('planner_calendar_links').delete().eq('task_id', taskId))
    },
    async writeTask(userId, id, fields, ts) {
      const field_ts = Object.fromEntries([...Object.keys(fields), 'device_id'].map((k) => [k, ts]))
      const row = must(
        await sb.from('planner_tasks').upsert({ id, user_id: userId, ...fields, device_id: 'calendar-sync', field_ts }, { onConflict: 'id', defaultToNull: false }).select('version').single(),
      ) as { version: number }
      return Number(row.version)
    },
    async userTz(userId) {
      const r = must(await sb.from('planner_settings').select('data').eq('user_id', userId).maybeSingle()) as { data?: { tz?: string } } | null
      return r?.data?.tz ?? 'UTC'
    },
  }
}
