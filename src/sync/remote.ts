import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Only the publishable pair ever reaches the client (CLAUDE.md project rules).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

let client: SupabaseClient | null = null

export function supabase(): SupabaseClient | null {
  if (!url || !key) return null
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  }
  return client
}
