import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AppHeader } from '@/components/app-header'
import { formatTrialDate, trialState } from '@/lib/trial'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Upgrade | Quick Tenders',
  description: 'Move your Quick Tenders account onto a paid plan.',
}

/** Per representative, so never prerendered. See app/dashboard/layout.tsx. */
export const dynamic = 'force-dynamic'

const REASONS: Record<string, string> = {
  expired: 'Your 3-day trial has ended, so matching and drafting are paused.',
  unavailable:
    'We could not confirm your trial status, so access is paused until we can.',
}

/** Stub. Real plans and billing are not wired up. */
export default async function UpgradePage({
  searchParams,
}: {
  searchParams: { reason?: string }
}) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/signup')

  const { data: company } = await supabase
    .from('companies')
    .select('name, plan, trial_ends_at')
    .limit(1)
    .maybeSingle()

  const trial = company ? trialState(company) : null
  const reason = searchParams.reason ? REASONS[searchParams.reason] : undefined

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <AppHeader right={company?.name ?? undefined} />

      <main className="mx-auto max-w-3xl px-6 py-16 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
          Upgrade
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Keep the agent running
        </h1>

        {reason ? (
          <div
            role="status"
            className="mt-8 rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm leading-relaxed text-amber-900"
          >
            <p className="font-semibold">{reason}</p>
            {trial?.endsAt ? (
              <p className="mt-2">
                The trial window closed on {formatTrialDate(trial.endsAt)}. Your
                company data is untouched and comes back as soon as you upgrade.
              </p>
            ) : null}
          </div>
        ) : null}

        <p className="mt-8 text-lg leading-relaxed text-slate-600">
          Plans and billing are not connected yet. This page exists so the trial
          gate has somewhere to send you, and so the flow can be walked end to
          end before payments are wired in.
        </p>

        <div className="mt-10 rounded-xl border border-slate-200 p-7">
          <h2 className="text-lg font-semibold">What to do in the meantime</h2>
          <p className="mt-3 leading-relaxed text-slate-600">
            Get in touch and we will extend the trial or set the account up
            manually while billing is being built.
          </p>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-md bg-blue-700 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Contact us
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 px-6 py-3 text-base font-semibold text-slate-900 transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Back to home
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
