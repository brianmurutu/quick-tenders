import { createBrowserClient } from '@supabase/ssr'

import { getSupabaseEnv } from '@/lib/env'
import type { Database } from '@/types/database'

/**
 * Typed Supabase client for Client Components and browser-side code.
 *
 * `createBrowserClient` memoises internally, so calling this from several
 * components still yields one client and one auth listener per page.
 */
export function createClient() {
  const { url, anonKey } = getSupabaseEnv()

  // Auth callback routes exchange one-time PKCE codes explicitly. Disable URL
  // auto-detection here so a page that handles a code itself cannot consume it
  // once during client initialization and again in its own callback.
  return createBrowserClient<Database>(url, anonKey, {
    auth: { detectSessionInUrl: false },
  })
}

export type SupabaseBrowserClient = ReturnType<typeof createClient>
