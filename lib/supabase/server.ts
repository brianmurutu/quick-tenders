import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { getSupabaseEnv } from '@/lib/env'
import type { Database } from '@/types/database'

/**
 * Typed Supabase client for Server Components, Server Actions and Route
 * Handlers. Reads the session from the request cookies, so every query runs as
 * the signed-in representative and RLS applies.
 *
 * Create one per request. Do not hoist the result into a module-level
 * singleton, or requests would share another user session.
 */
export function createClient() {
  const { url, anonKey } = getSupabaseEnv()
  const cookieStore = cookies()

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Components get a read-only cookie store. Refreshed tokens
          // are written by the middleware instead (lib/supabase/middleware.ts),
          // so swallowing this is safe.
        }
      },
    },
  })
}

export type SupabaseServerClient = ReturnType<typeof createClient>
