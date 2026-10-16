import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

import { sendOnboardingEmail } from '@/lib/email/onboarding'
import { ensureUserOnboarded } from '@/lib/onboarding-recovery'
import { createClient } from '@/lib/supabase/server'
import { safeRelativePath } from '@/lib/url'

/**
 * Maps the onboarding RPC failures onto the ?error= codes the signup page knows
 * how to explain. Both duplicate paths raise 23505, so match on the message.
 */
function onboardingErrorCode(message: string): string {
  if (message.includes('not_company_domain')) return 'not_company_domain'
  if (message.includes('taken') || message.includes('already registered')) {
    return 'domain_taken'
  }

  return 'onboarding_failed'
}

function companyNameFromUserMetadata(
  metadata: Record<string, unknown> | undefined,
): string {
  const raw = metadata && typeof metadata.company_name === 'string'
    ? metadata.company_name.trim()
    : ''

  return raw || 'your company'
}

function fullNameFromUserMetadata(
  metadata: Record<string, unknown> | undefined,
): string {
  const fullName = metadata && typeof metadata.full_name === 'string'
    ? metadata.full_name.trim()
    : ''

  return fullName || 'there'
}

/**
 * Where the email confirmation link and Google OAuth redirect land. Exchanges the
 * link for a session and then finishes onboarding in the same authenticated
 * session, which is the first moment the company row can be created.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const flow = (url.searchParams.get('flow') ?? '').toLowerCase()
  // Signup lands on onboarding unless a ?next= says otherwise; Google sign-in
  // defaults to the dashboard because the user is already authenticated.
  const next = safeRelativePath(
    url.searchParams.get('next'),
    flow === 'signin' ? '/dashboard' : '/onboarding',
  )

  const back = (error: string) =>
    NextResponse.redirect(new URL(`/signup?error=${error}`, url.origin))

  // Supabase sends ?code= for the PKCE flow, or ?token_hash=&type= depending on
  // how the confirmation email template is configured. Reject a link carrying
  // neither before building a client, so a malformed link is a redirect rather
  // than a 500.
  const usesCode = Boolean(code)
  const usesTokenHash = Boolean(tokenHash && type)

  if (!usesCode && !usesTokenHash) {
    return back('missing_code')
  }

  const supabase = createClient()

  let userId: string | undefined

  if (usesCode) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code as string)
    if (error) return back('confirmation_failed')
    userId = data.user?.id
  } else {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash as string,
      type: type as EmailOtpType,
    })
    if (error) return back('confirmation_failed')
    userId = data.user?.id
  }

  if (!userId) {
    return back('confirmation_failed')
  }

  const { data: existingRepresentative, error: repLookupError } = await supabase
    .from('representatives')
    .select('company_id')
    .eq('id', userId)
    .maybeSingle()

  const needsOnboarding = !repLookupError && !existingRepresentative?.company_id

  if (needsOnboarding) {
    const { error: onboardingError } = await supabase.rpc('complete_onboarding')

    if (onboardingError) {
      const recovery = await ensureUserOnboarded(userId)
      if (!recovery.ok) {
        return back(onboardingErrorCode(onboardingError.message))
      }
    }

    const { data: userData, error: userLookupError } = await supabase.auth.getUser()
    const user = userData?.user

    if (!userLookupError && user?.email && (flow === 'signup' || flow === 'signin')) {
      const companyName = companyNameFromUserMetadata(user.user_metadata)
      const fullName = fullNameFromUserMetadata(user.user_metadata)

      try {
        await sendOnboardingEmail({
          email: user.email,
          fullName,
          companyName,
        })
      } catch (error) {
        console.error('[auth] Welcome email could not be sent after callback:', error)
      }
    }
  }

  const destination = flow === 'signin' && needsOnboarding ? '/onboarding' : next
  return NextResponse.redirect(new URL(destination, url.origin))
}
