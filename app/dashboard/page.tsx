import type { Metadata } from 'next'
import Link from 'next/link'

import { AppHeader } from '@/components/app-header'
import { formatTrialDate, trialState } from '@/lib/trial'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Dashboard | Quick Tenders',
  description: 'Matched tenders for your company.',
}

/**
 * Stub. The trial gate in layout.tsx is the part that is finished; the matched
 * tender list is not built yet.
 */
export default async function DashboardPage() {
  const supabase = createClient()

  // The layout has already established that there is a user with a company and
  // an open trial, so this only needs the values it wants to display.
  const { data: company } = await supabase
    .from('companies')
    .select('name, plan, trial_ends_at')
    .limit(1)
    .maybeSingle()

  const { count: tenderCount } = await supabase
    .from('tenders_matched')
    .select('id', { count: 'exact', head: true })

  const trial = company ? trialState(company) : null

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <AppHeader right={company?.name ?? undefined} />

      <main className="mx-auto max-w-5xl px-6 py-16 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-2 text-slate-600">
              Matched tenders for {company?.name ?? 'your company'}.
            </p>
          </div>

          {trial?.onTrial ? (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
              Trial ends {formatTrialDate(trial.endsAt)}
              <span className="mx-2 text-slate-300">|</span>
              <Link
                href="/upgrade"
                className="rounded-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
              >
                Upgrade
              </Link>
            </p>
          ) : null}
        </div>

        <div className="mt-12 rounded-xl border border-slate-200 p-8">
          <h2 className="text-lg font-semibold">
            {tenderCount ? `${tenderCount} matched tenders` : 'No matches yet'}
          </h2>
          <p className="mt-2 max-w-xl leading-relaxed text-slate-600">
            The matching pipeline is not connected yet, so nothing will appear
            here until it is. The schema, the trial gate and the access rules
            behind this page are in place.
          </p>
        </div>
      </main>
    </div>
  )
}
