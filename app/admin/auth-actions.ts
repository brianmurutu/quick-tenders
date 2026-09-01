'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getSiteUrl } from '@/lib/env'

export type ResendAuthResult = {
  ok: boolean
  message: string
  actionLink?: string
}

/**
 * Asserts the caller is an active administrator.
 */
async function assertAdmin() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (!adminRow) throw new Error('Not an admin')

  return { supabase, user }
}

/**
 * Server Action: Resends a confirmation email or generates a direct auth link
 * for a user email address using the correct site URL callback.
 */
export async function resendAuthEmailAction(
  email: string,
): Promise<ResendAuthResult> {
  const trimmed = email.trim().toLowerCase()
  if (!trimmed || !trimmed.includes('@')) {
    return { ok: false, message: 'Please provide a valid email address.' }
  }

  try {
    await assertAdmin()

    const siteUrl = getSiteUrl()
    const redirectTo = `${siteUrl}/auth/callback`
    const admin = createAdminClient()

    // Resend confirmation email via Supabase Auth
    const resendResult = await admin.auth.resend({
      type: 'signup',
      email: trimmed,
      options: {
        emailRedirectTo: redirectTo,
      },
    })

    // Also attempt to generate a direct magic link in case email delivery fails or is delayed
    let actionLink: string | undefined
    try {
      const linkResult = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: trimmed,
        options: {
          redirectTo,
        },
      })
      if (!linkResult.error && linkResult.data?.properties?.action_link) {
        actionLink = linkResult.data.properties.action_link
      }
    } catch {
      // ignore magiclink generation error if resend succeeded
    }

    if (resendResult.error && !actionLink) {
      return {
        ok: false,
        message:
          resendResult.error.message ||
          'Failed to resend auth email. User may not exist in Auth records.',
      }
    }

    return {
      ok: true,
      message: `Auth confirmation email dispatched to ${trimmed} with redirect to ${siteUrl}.`,
      actionLink,
    }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'An unexpected error occurred.',
    }
  }
}
