'use server'

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

/**
 * Sign out and return to the sign-in page.
 *
 * A Server Action rather than a POST route handler, because Server Actions carry
 * origin checking: a plain endpoint could be hit by a cross-site form and sign
 * somebody out without their asking.
 */
export async function signOutAction(): Promise<void> {
  const supabase = createClient()

  // 'local' clears this browser only. A representative signing out on a shared
  // machine should not be killing their own session on their phone.
  await supabase.auth.signOut({ scope: 'local' })

  redirect('/login?reason=signed_out')
}
