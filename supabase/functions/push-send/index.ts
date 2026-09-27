// Every minute via pg_cron (db/003_cron.sql) with x-cron-secret: web push for reminders due in the next 60 s.
// @ts-types="npm:@types/web-push@3.6.4"
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { handlePushSend, type PushPorts, type PushSub } from '../_shared/push.ts'
import type { DueException, DueTask } from '../_shared/due.ts'

const env = (k: string) => Deno.env.get(k) ?? ''
webpush.setVapidDetails(env('VAPID_SUBJECT') || 'https://schnubsy.github.io/optimo/', env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'))
const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
const must = <T>(r: { data: T; error: { message: string } | null }) => {
  if (r.error) throw new Error(r.error.message)
  return r.data
}

const ports: PushPorts = {
  cronSecret: env('CRON_SECRET'),
  log: (m) => console.log(m),
  async subscriptions() {
    return (must(await sb.from('planner_push_subscriptions').select('endpoint,user_id,p256dh,auth').is('disabled_at', null)) ?? []) as PushSub[]
  },
  async userData(userId, now) {
    const from = new Date(now.getTime() - 86_400_000).toISOString()
    const to = new Date(now.getTime() + 2 * 86_400_000).toISOString()
    const cols = 'id,title,start_at,reminders,completed_at,deleted_at,rrule,dtstart'
    const plain = must(await sb.from('planner_tasks').select(cols).eq('user_id', userId).is('deleted_at', null).is('rrule', null).gte('start_at', from).lt('start_at', to)) as DueTask[]
    const series = must(await sb.from('planner_tasks').select(cols).eq('user_id', userId).is('deleted_at', null).not('rrule', 'is', null)) as DueTask[]
    const exceptions = must(await sb.from('planner_exceptions').select('series_id,occurrence_date,task_id,skipped,deleted_at').eq('user_id', userId)) as DueException[]
    const settings = must(await sb.from('planner_settings').select('data').eq('user_id', userId).maybeSingle()) as { data?: { tz?: string; clock24?: boolean } } | null
    return { tasks: [...plain, ...series], exceptions, tz: settings?.data?.tz ?? 'UTC', clock24: settings?.data?.clock24 ?? true }
  },
  async sentKeys(userId) {
    const since = new Date(Date.now() - 3 * 86_400_000).toISOString()
    const rows = must(await sb.from('planner_reminder_sent').select('task_id,occurrence_date,minutes_before').eq('user_id', userId).gte('sent_at', since)) as { task_id: string; occurrence_date: string; minutes_before: number }[]
    return new Set(rows.map((r) => `${r.task_id}|${r.occurrence_date}|${r.minutes_before}`))
  },
  async markSent(rows) {
    if (rows.length) must(await sb.from('planner_reminder_sent').upsert(rows, { onConflict: 'task_id,occurrence_date,minutes_before', ignoreDuplicates: true }))
  },
  async send(s, body) {
    try {
      const r = await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 600, urgency: 'high' })
      return r.statusCode
    } catch (e) {
      return (e as { statusCode?: number }).statusCode ?? 0
    }
  },
  async removeSubscription(endpoint) {
    must(await sb.from('planner_push_subscriptions').delete().eq('endpoint', endpoint))
  },
}

Deno.serve((req) => handlePushSend(req, ports))
