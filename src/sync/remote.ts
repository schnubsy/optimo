import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { PRESS_KEY, migrateLegacySession, pressStorage } from '../auth/pressSession'

// Only the publishable pair ever reaches the client (CLAUDE.md project rules).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

let client: SupabaseClient | null = null

export function supabase(): SupabaseClient | null {
  if (!url || !key) return null
  if (!client) {
    migrateLegacySession(localStorage)
    client = createClient(url, key, {
      // The Family Wing session (press:family:v1) is the session — read and rotated in place, never a copy.
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: PRESS_KEY,
        storage: pressStorage(localStorage),
      },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  }
  return client
}
