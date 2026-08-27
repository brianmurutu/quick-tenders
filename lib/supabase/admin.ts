import { createClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

/**
 * Service role Supabase client. Bypasses RLS entirely.
 *
 * This exists for the scheduled jobs, which have to read every company and write
 * for all of them: tender discovery and bid document drafting. No representative
 * identity can do that, and these are the only places in the app where
 * per-tenant scoping is not what we want.
 *
 * Rules for touching this file:
 *   - SUPABASE_SERVICE_ROLE_KEY has no NEXT_PUBLIC_ prefix, so it is never
 *     inlined into a client bundle. Keep it that way.
 *   - Never import this from a Client Component, a Server Component that renders
 *     user facing pages, or anything reachable from the browser. Server side
 *     scheduled work only.
 *   - Every query written against it must scope by company_id itself, because
 *     nothing else will.
 */
export function createAdminClient() {
  // A guard rather than a comment: if this module is ever pulled into a client
  // bundle, fail loudly at the point of use instead of leaking quietly.
  if (typeof window !== 'undefined') {
    throw new Error(
      'createAdminClient was called in the browser. The service role key must ' +
        'never reach the client.',
    )
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY. The ' +
        'scheduled jobs cannot run without them.',
    )
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      // No user session, no token refresh, nothing persisted between runs.
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export type SupabaseAdminClient = ReturnType<typeof createAdminClient>
