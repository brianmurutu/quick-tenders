'use server'

import { getSiteUrl } from '@/lib/env'
import {
  emailDomain,
  validateSignUp,
  type SignUpFieldErrors,
  type SignUpInput,
} from '@/lib/signup'
import { createClient } from '@/lib/supabase/server'

export type SignUpResult =
  /** Field level problems, shown inline on the form. */
  | { status: 'invalid'; fieldErrors: SignUpFieldErrors }
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

  // Check the domain before creating an auth user, so a company that already has
  // an account finds out now rather than after confirming their email.
  const { data: domainStatus, error: statusError } = await supabase.rpc(
    'company_domain_status',
    { p_domain: domain },
  )

  if (statusError) {
    return {
      status: 'error',
      message:
        'We could not reach the service to check your company domain. Try again in a moment.',
    }
  }

  if (domainStatus === 'taken') {
    return {
      status: 'invalid',
      fieldErrors: {
        email: `An account already exists for ${domain}. Ask the colleague who set it up for access.`,
      },
    }
  }

  if (domainStatus === 'not_company_domain') {
    return {
      status: 'invalid',
      fieldErrors: {
        email:
          'Use your company email address. Consumer and disposable email providers cannot register a company.',
      },
    }
  }

  if (domainStatus !== 'available') {
    return {
      status: 'invalid',
      fieldErrors: { email: 'That does not look like a company email address.' },
    }
  }

  // Company details ride along in the auth user metadata, so nothing has to be
  // stored between signup and email confirmation. complete_onboarding reads them
  // back out. The domain is not passed: it is derived from the verified address.
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/callback`,
      data: {
        full_name: input.fullName.trim(),
        company_name: input.companyName.trim(),
        industry: input.industry,
        region: input.region,
        company_size: input.companySize,
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
