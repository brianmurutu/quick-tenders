import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { trialState } from '@/lib/trial'
import { createClient } from '@/lib/supabase/server'

/**
 * Never prerender anything under /dashboard. The content is per representative
 * and gated on a live trial window, and declaring it here also keeps the build
 * working without Supabase credentials present.
 */
export const dynamic = 'force-dynamic'

/**
 * The trial gate for everything under /dashboard.
 *
 * This is a server check rather than middleware on purpose. Middleware runs on
 * the Edge for every matched request, so putting the company lookup there would
 * add a database round trip to static asset requests too, and it still could not
 * be the authoritative boundary: RLS and this layout are what actually decide.
 * A layout guard runs once per navigation into the segment and covers every
 * nested route beneath it.
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // No sign-in page exists yet, so an unauthenticated visitor goes to signup.
  if (!user) redirect('/signup')

  // RLS scopes this to the caller company, so no filter is needed.
  const { data: company, error } = await supabase
    .from('companies')
    .select('plan, trial_ends_at')
    .limit(1)
    .maybeSingle()

  // Fail closed: if the trial window cannot be read, do not assume it is open.
  if (error) redirect('/upgrade?reason=unavailable')

  // Authenticated but with no company means onboarding never completed.
  if (!company) redirect('/onboarding')

  if (trialState(company).expired) redirect('/upgrade?reason=expired')

  return <>{children}</>
}
