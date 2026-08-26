import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { readSupabaseEnv } from '@/lib/env'
import type { Database } from '@/types/database'

/**
 * Refreshes the Supabase auth token and copies the rotated cookies onto the
 * outgoing response. Without this, access tokens expire mid-session and Server
 * Components start seeing a signed-out user.
 *
 * Wired up in the root middleware.ts.
 */
export async function updateSession(request: NextRequest) {
  const env = readSupabaseEnv()

  // Nothing useful to do before the project is configured. Warn rather than
  // throw, so `npm run dev` works on a fresh clone with no .env.local.
  if (!env) {
    console.warn(
      '[supabase] Skipping session refresh: NEXT_PUBLIC_SUPABASE_URL / ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY are not set.',
    )
    return NextResponse.next({ request })
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }

        response = NextResponse.next({ request })

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // Touching getUser() is what triggers the refresh; the result is unused here.
  await supabase.auth.getUser()

  return response
}
