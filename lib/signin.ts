/**
 * Sign-in field definitions, validation, and the mapping from Supabase auth
 * errors to something a person can act on.
 *
 * Shared by the client form and the server action so both enforce the same rules.
 */

export type SignInInput = {
  email: string
  password: string
}

export type SignInField = keyof SignInInput

export type SignInFieldErrors = Partial<Record<SignInField, string>>

export const EMPTY_SIGN_IN: SignInInput = { email: '', password: '' }

export function validateSignIn(input: SignInInput): SignInFieldErrors {
  const errors: SignInFieldErrors = {}

  if (!input.email.trim()) {
    errors.email = 'Enter your company email address.'
  } else if (!input.email.includes('@')) {
    errors.email = 'That does not look like an email address.'
  }

  if (!input.password) {
    errors.password = 'Enter your password.'
  }

  return errors
}

/**
 * Turns a Supabase auth error into a message.
 *
 * Note what is deliberately NOT distinguished: a wrong password and an unknown
 * email both produce the same "do not match" wording, because Supabase returns
 * one error for both and telling them apart would turn this form into an account
 * enumeration oracle. Anything unrecognised gets the generic message rather than
 * the raw text, which can carry internals.
 */
export function signInErrorMessage(raw: string): string {
  const message = raw.toLowerCase()

  if (message.includes('invalid login credentials')) {
    return 'That email address and password do not match an account.'
  }

  if (message.includes('email not confirmed')) {
    return 'Your email address has not been confirmed yet. Open the confirmation link we sent you, then sign in.'
  }

  if (message.includes('rate limit') || message.includes('too many')) {
    return 'Too many attempts. Wait a minute and try again.'
  }

  return 'We could not sign you in just now. Try again in a moment.'
}

/** Messages for the ?reason= values other pages redirect here with. */
export const SIGN_IN_REASONS: Record<string, string> = {
  signed_out: 'You have been signed out.',
  session_expired: 'Your session has expired. Sign in again to carry on.',
  sign_in_required: 'Sign in to see your tenders.',
}
