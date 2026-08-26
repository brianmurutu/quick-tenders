'use server'

import {
  signInErrorMessage,
  validateSignIn,
  type SignInFieldErrors,
  type SignInInput,
} from '@/lib/signin'
import { createClient } from '@/lib/supabase/server'
import { safeRelativePath } from '@/lib/url'

export type SignInResult =
  | { status: 'invalid'; fieldErrors: SignInFieldErrors }
  | { status: 'error'; message: string }
  /** `next` is already validated as a same-origin relative path. */
  | { status: 'signed-in'; next: string }

export async function signIn(
  input: SignInInput,
  next?: string,
): Promise<SignInResult> {
  const fieldErrors = validateSignIn(input)

  if (Object.keys(fieldErrors).length > 0) {
    return { status: 'invalid', fieldErrors }
  }

  const supabase = createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  })

  if (error) {
    return { status: 'error', message: signInErrorMessage(error.message) }
  }

  // ?next= comes from a query string, so it is attacker controllable. Anything
  // that is not a same-origin relative path falls back to the dashboard, or this
  // form would be an open redirect on a page people are trained to trust.
  return { status: 'signed-in', next: safeRelativePath(next, '/dashboard') }
}
