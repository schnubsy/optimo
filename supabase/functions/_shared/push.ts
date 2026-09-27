// push-send: every minute (pg_cron, x-cron-secret) — reminders due in [now, now+60s) for users with a live push
// subscription → web push to each of their endpoints; 404/410 endpoints are pruned; sends are recorded once.
import { dueReminders, payload, sentKey, type DueException, type DueTask } from './due.ts'

export interface PushSub {
  endpoint: string
  user_id: string
  p256dh: string
  auth: string
}
export interface PushPorts {
  cronSecret: string
  subscriptions(): Promise<PushSub[]>
  userData(userId: string, now: Date): Promise<{ tasks: DueTask[]; exceptions: DueException[]; tz: string; clock24: boolean }>
  sentKeys(userId: string): Promise<Set<string>>
  markSent(rows: { task_id: string; occurrence_date: string; minutes_before: number; user_id: string }[]): Promise<void>
  send(sub: PushSub, body: string): Promise<number> // HTTP status from the push service
  removeSubscription(endpoint: string): Promise<void>
  log?(m: string): void
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export async function handlePushSend(req: Request, p: PushPorts, now = new Date()): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'POST only' })
  if (!p.cronSecret || req.headers.get('x-cron-secret') !== p.cronSecret) return json(401, { error: 'bad cron secret' })
  const subs = await p.subscriptions()
  const byUser = new Map<string, PushSub[]>()
  for (const s of subs) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s])
  let sent = 0
  let pruned = 0
  for (const [userId, userSubs] of byUser) {
    const { tasks, exceptions, tz, clock24 } = await p.userData(userId, now)
    const due = dueReminders(tasks, exceptions, await p.sentKeys(userId), now, tz)
    if (!due.length) continue
    let live = userSubs
    for (const d of due) {
      const body = JSON.stringify(payload(d, tz, clock24))
      const keep: PushSub[] = []
      for (const s of live) {
        const status = await p.send(s, body).catch(() => 0)
        if (status === 404 || status === 410) {
          await p.removeSubscription(s.endpoint)
          pruned++
        } else {
          keep.push(s)
          if (status >= 200 && status < 300) sent++
        }
      }
      live = keep
    }
    // recorded once per (task, occurrence, lead) — the window never offers it again
    await p.markSent(due.map((d) => ({ task_id: d.task_id, occurrence_date: d.occurrence_date, minutes_before: d.minutes_before, user_id: userId })))
    p.log?.(`push-send: user ${userId.slice(0, 8)} due=${due.length}`)
  }
  return json(200, { users: byUser.size, sent, pruned })
}

export { sentKey }
