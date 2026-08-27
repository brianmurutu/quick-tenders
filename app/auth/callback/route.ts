import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

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

/**
 * Where the email confirmation link lands. Exchanges the link for a session and
 * then finishes onboarding, which is the first moment the user is authenticated
 * and so the first moment the company row can be created.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  // Signup lands on onboarding unless a ?next= says otherwise.
  const next = safeRelativePath(url.searchParams.get('next'), '/onboarding')

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

  if (usesCode) {
    const { error } = await supabase.auth.exchangeCodeForSession(code as string)
    if (error) return back('confirmation_failed')
  } else {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash as string,
      type: type as EmailOtpType,
    })
    if (error) return back('confirmation_failed')
  }

  const { error: onboardingError } = await supabase.rpc('complete_onboarding')

  if (onboardingError) {
    return back(onboardingErrorCode(onboardingError.message))
  }

  return NextResponse.redirect(new URL(next, url.origin))
}
