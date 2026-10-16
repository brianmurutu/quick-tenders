'use server'

import {
  signInErrorMessage,
  validateSignIn,
  type SignInFieldErrors,
  type SignInInput,
} from '@/lib/signin'
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

  // ?next= comes from a query string, so it is attacker controllable. Anything
  // that is not a same-origin relative path falls back to the dashboard, or this
  // form would be an open redirect on a page people are trained to trust.
  return { status: 'signed-in', next: safeRelativePath(next, '/dashboard') }
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
