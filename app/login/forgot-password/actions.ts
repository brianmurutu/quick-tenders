'use server'

import { createClient } from '@/lib/supabase/server'
import { getSiteUrl } from '@/lib/env'

export type ForgotPasswordResult =
  | { status: 'sent' }
  | { status: 'error'; message: string }

export async function requestPasswordReset(email: string): Promise<ForgotPasswordResult> {
  const trimmed = email.trim().toLowerCase()

  if (!trimmed || !trimmed.includes('@')) {
    return { status: 'error', message: 'Enter a valid email address.' }
  }

  const supabase = createClient()
  const redirectTo = `${getSiteUrl()}/auth/reset-password`

  // Supabase always returns ok=true here (no account enumeration).
  // If the email exists a magic link is sent; if not, nothing happens.
  const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo })

  if (error) {
    return { status: 'error', message: 'We could not send the reset link just now. Try again in a moment.' }
  }

  return { status: 'sent' }
}
