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

  return createBrowserClient<Database>(url, anonKey)
}

export type SupabaseBrowserClient = ReturnType<typeof createClient>
