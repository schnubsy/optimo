// Deno-side ports: service-role supabase-js against press. Only Edge Functions hold the service role key.
import { createClient } from '@supabase/supabase-js'
import type { AccountRow, EventRow, Ports } from './handlers.ts'
import { eventKey } from './handlers.ts'

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
  }
}
