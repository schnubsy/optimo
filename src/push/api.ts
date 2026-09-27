// planner_push_subscriptions — one row per browser endpoint (RLS: own rows). push-send reads them server-side.
import { supabase } from '../sync/remote'

export interface SubscriptionRow {
  endpoint: string
  p256dh: string
  auth: string
  ua: string | null
}

export async function saveSubscription(row: SubscriptionRow) {
  const sb = supabase()
  if (!sb) throw new Error('Push needs the synced app (sign in first).')
  const { error } = await sb.from('planner_push_subscriptions').upsert({ ...row, last_seen_at: new Date().toISOString(), disabled_at: null }, { onConflict: 'endpoint' })
  if (error) throw new Error(error.message)
}

export async function removeSubscription(endpoint: string) {
  const sb = supabase()
  if (!sb) return
  const { error } = await sb.from('planner_push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) throw new Error(error.message)
}
