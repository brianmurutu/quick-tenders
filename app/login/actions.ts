'use server'

import {
  signInDestination,
  signInErrorMessage,
  validateSignIn,
  type SignInFieldErrors,
  type SignInInput,
} from '@/lib/signin'
import { isAdminUser } from '@/lib/admin-auth'
import { getSiteUrl } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'
import { safeRelativePath } from '@/lib/url'
import { turnstileMissingTokenMessage, verifyTurnstile } from '@/lib/turnstile'

export type SignInResult =
  | { status: 'invalid'; fieldErrors: SignInFieldErrors }
  | { status: 'error'; message: string }
  /** `next` is already validated as a same-origin relative path. */
  | { status: 'signed-in'; next: string }

export async function signIn(
  input: SignInInput,
  next?: string,
  captchaToken?: string,
): Promise<SignInResult> {
  const fieldErrors = validateSignIn(input)

  if (Object.keys(fieldErrors).length > 0) {
    return { status: 'invalid', fieldErrors }
  }

  const captchaError = turnstileMissingTokenMessage()
  if (captchaError && !captchaToken?.trim()) {
    return { status: 'error', message: captchaError }
  }

  const supabase = createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: { captchaToken: captchaToken?.trim() },
  })

  if (error) {
    return { status: 'error', message: signInErrorMessage(error.message) }
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    console.error('[auth] Could not verify signed-in user after password login:', userError?.message)
    return {
      status: 'error',
      message: 'You signed in, but we could not confirm your account. Refresh and try again.',
    }
  }

  try {
    const isAdmin = await isAdminUser(supabase, user.id)
    return { status: 'signed-in', next: signInDestination(isAdmin, next) }
  } catch {
    return {
      status: 'error',
      message: 'You signed in, but we could not verify your account access. Refresh and try again.',
    }
  }
}

export type GoogleAuthResult =
  | { status: 'redirect'; url: string }
  | { status: 'error'; message: string }

export async function startGoogleAuth(
  flow: 'signup' | 'signin',
  next: string | undefined,
  captchaToken?: string,
): Promise<GoogleAuthResult> {
  const captchaError = turnstileMissingTokenMessage()
  if (captchaError && !captchaToken?.trim()) {
    return { status: 'error', message: captchaError }
  }

  const verification = await verifyTurnstile(captchaToken, 'google_auth')
  if (!verification.ok) return { status: 'error', message: verification.message }

  const destination = safeRelativePath(next, flow === 'signup' ? '/onboarding' : '/dashboard')
  const callback = new URL(`${getSiteUrl()}/auth/callback`)
  callback.searchParams.set('flow', flow)
  callback.searchParams.set('next', destination)

  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: callback.toString() },
  })

  if (error || !data.url) {
    console.error('[auth] Google OAuth could not start:', error?.status ?? 'unknown status')
    return {
      status: 'error',
      message: 'Google sign-in could not start. Please try again in a moment.',
    }
  }

  return { status: 'redirect', url: data.url }
}
