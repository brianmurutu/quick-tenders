'use server'

import { getSiteUrl } from '@/lib/env'
import {
  companyExistsMessage,
  emailDomain,
  parseSignupStatus,
  validateSignUp,
  type SignUpFieldErrors,
  type SignUpInput,
} from '@/lib/signup'
import { createClient } from '@/lib/supabase/server'

export type SignUpResult =
  /** Field level problems, shown inline on the form. */
  | { status: 'invalid'; fieldErrors: SignUpFieldErrors }
  /** A colleague already holds the company account. Hard stop. */
  | {
      status: 'company-exists'
      message: string
      companyName: string | null
      representativeEmail: string
    }
  /** Something went wrong that the user cannot fix by editing a field. */
  | { status: 'error'; message: string }
  /** Normal path with email confirmations on: nothing exists until they click. */
  | { status: 'confirm-email'; email: string }
  /** Confirmations are off on the project, so the account is already live. */
  | { status: 'ready' }

export async function signUp(input: SignUpInput): Promise<SignUpResult> {
  const fieldErrors = validateSignUp(input)

  if (Object.keys(fieldErrors).length > 0) {
    return { status: 'invalid', fieldErrors }
  }

  const email = input.email.trim().toLowerCase()
  const domain = emailDomain(email)

  if (!domain) {
    return {
      status: 'invalid',
      fieldErrors: { email: 'That does not look like an email address.' },
    }
  }

  const supabase = createClient()

  // Gate on the domain before creating an auth user, so a company that already
  // has a representative is turned away now rather than after confirming an
  // email that can never be onboarded.
  const { data: rawStatus, error: statusError } = await supabase.rpc(
    'company_signup_status',
    { p_domain: domain },
  )

  if (statusError) {
    return {
      status: 'error',
      message:
        'We could not reach the service to check your company domain. Try again in a moment.',
    }
  }

  const domainStatus = parseSignupStatus(rawStatus)

  if (!domainStatus) {
    return {
      status: 'error',
      message:
        'We got an unexpected response while checking your company domain. Try again in a moment.',
    }
  }

  if (domainStatus.status === 'representative_exists') {
    return {
      status: 'company-exists',
      message: companyExistsMessage(domainStatus),
      companyName: domainStatus.companyName,
      representativeEmail: domainStatus.representativeEmail,
    }
  }

  if (domainStatus.status === 'not_company_domain') {
    return {
      status: 'invalid',
      fieldErrors: {
        email:
          'Use your company email address. Consumer and disposable email providers cannot register a company.',
      },
    }
  }

  if (domainStatus.status === 'invalid') {
    return {
      status: 'invalid',
      fieldErrors: { email: 'That does not look like a company email address.' },
    }
  }

  // 'available' creates a new company; 'join_existing' claims a company row that
  // exists but has no representative yet. complete_onboarding decides which.
  //
  // Only the account details ride along in metadata. The matching profile is
  // collected at /onboarding, so those columns start null.
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      // The callback defaults to /onboarding when no ?next= is given.
      emailRedirectTo: `${getSiteUrl()}/auth/callback`,
      data: {
        full_name: input.fullName.trim(),
        company_name: input.companyName.trim(),
      },
    },
  })

  if (error) {
    return { status: 'error', message: error.message }
  }

  // With email confirmations turned off, signUp returns a live session, so the
  // account can be finished immediately instead of waiting for a callback.
  if (data.session) {
    const { error: onboardingError } = await supabase.rpc('complete_onboarding')

    if (onboardingError) {
      return {
        status: 'error',
        message:
          'Your account was created, but we could not finish setting up your company. Get in touch and we will sort it out.',
      }
    }

    return { status: 'ready' }
  }

  return { status: 'confirm-email', email }
}
