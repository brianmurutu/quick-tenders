import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AppHeader } from '@/components/app-header'
import {
  COMPANY_SIZES,
  COUNTIES,
  INDUSTRIES,
  SECTORS,
  type CompanyProfile,
} from '@/lib/company-profile'
import { createClient } from '@/lib/supabase/server'
import { formatTrialDate, trialState } from '@/lib/trial'

import { OnboardingForm } from './onboarding-form'

export const metadata: Metadata = {
  title: 'Onboarding | Quick Tenders',
  description: 'Tell Quick Tenders what your company bids on.',
}

/** Per representative, so never prerendered. See app/dashboard/layout.tsx. */
export const dynamic = 'force-dynamic'

/** Keeps a stored value only if it is still on the list the form offers. */
function knownValue(list: readonly string[], value: string | null): string {
  return value && list.includes(value) ? value : ''
}

export default async function OnboardingPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Not signed in, or the session has lapsed.
  if (!user) redirect('/login?reason=sign_in_required&next=/onboarding')

  // RLS scopes this to the caller company, so no filter is needed.
  const { data: company } = await supabase
    .from('companies')
    .select('name, domain, industry, sectors_of_interest, region, company_size, plan, trial_ends_at')
    .limit(1)
    .maybeSingle()

  // Authenticated but with no company means onboarding never completed.
  if (!company) redirect('/signup?error=onboarding_failed')

  const trial = trialState(company)

  // Prefill from whatever is already stored, dropping anything that is no longer
  // an option so the form never starts on a value it cannot submit.
  const initial: CompanyProfile = {
    industry: knownValue(INDUSTRIES, company.industry),
    sectors_of_interest: (company.sectors_of_interest ?? []).filter((sector) =>
      SECTORS.includes(sector as (typeof SECTORS)[number]),
    ),
    region: knownValue(COUNTIES, company.region),
    company_size: knownValue(COMPANY_SIZES, company.company_size),
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <AppHeader right={company.name ?? company.domain} />

      <main className="mx-auto max-w-3xl px-6 py-16 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
          Onboarding
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          What does your company bid on?
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-slate-600">
          This is the profile the agent scores every tender against, so it is
          worth a minute. Sharper answers mean a shorter, more useful list.
        </p>

        {trial.onTrial && trial.endsAt ? (
          <p className="mt-6 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {trial.expired
              ? `Your trial ended on ${formatTrialDate(trial.endsAt)}. You can still finish this profile.`
              : `Your trial runs until ${formatTrialDate(trial.endsAt)}.`}
          </p>
        ) : null}

        <div className="mt-12">
          <OnboardingForm initial={initial} />
        </div>
      </main>
    </div>
  )
}
