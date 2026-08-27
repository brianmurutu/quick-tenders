import type { Metadata } from 'next'
import Link from 'next/link'

import { AppHeader } from '@/components/app-header'
import { createClient } from '@/lib/supabase/server'
import {
  TENDER_TABS,
  countByBucket,
  deadlinePhrase,
  filterByTab,
  formatDate,
  formatMatchScore,
  isUrgent,
  isoToday,
  parseTab,
  tenderBucket,
  type TenderBucket,
  type TenderTab,
} from '@/lib/tender-status'
import { formatTrialDate, trialState } from '@/lib/trial'

import { AutomationTrigger } from './automation-trigger'

export const metadata: Metadata = {
  title: 'Dashboard | Quick Tenders',
  description: 'Matched tenders for your company.',
}

/** Per representative and gated on a live trial. See app/dashboard/layout.tsx. */
export const dynamic = 'force-dynamic'

/**
 * Upper bound on one page of tenders. RLS already limits this to one company, and
 * a company accumulating more than this needs pagination rather than a bigger
 * number. Fetching the whole set in one query is what lets the tab counts be
 * exact without five extra round trips.
 */
const MAX_TENDERS = 500

const BUCKET_STYLES: Record<TenderBucket, string> = {
  new: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  reviewed: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  submitted: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
  expired: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
}

const BUCKET_LABELS: Record<TenderBucket, string> = {
  new: 'New',
  reviewed: 'Reviewed',
  submitted: 'Submitted',
  expired: 'Expired',
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { status?: string | string[] }
}) {
  const supabase = createClient()
  const tab = parseTab(searchParams.status)
  const today = isoToday()

  // Both queries are scoped by RLS to the caller company, so neither needs a
  // company filter of its own.
  const [companyResult, tendersResult] = await Promise.all([
    supabase.from('companies').select('name, plan, trial_ends_at').limit(1).maybeSingle(),
    supabase
      .from('tenders_matched')
      .select('id, title, procuring_entity, deadline, match_score, status')
      // Soonest deadline first. Tenders without one sort last rather than
      // crowding the top, which is what nullsFirst: false gets us.
      .order('deadline', { ascending: true, nullsFirst: false })
      .order('match_score', { ascending: false, nullsFirst: false })
      .limit(MAX_TENDERS),
  ])

  const company = companyResult.data
  const tenders = tendersResult.data ?? []
  const counts = countByBucket(tenders, today)
  const visible = filterByTab(tenders, tab, today)
  const trial = company ? trialState(company) : null

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <AppHeader right={company?.name ?? undefined} />

      <main className="mx-auto max-w-5xl px-6 py-12 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Matched tenders</h1>
            <p className="mt-2 text-slate-600">
              {counts.all === 0
                ? 'Nothing has been matched yet.'
                : `${counts.all} tender${counts.all === 1 ? '' : 's'} matched for ${company?.name ?? 'your company'}.`}
            </p>
          </div>

          {company?.plan === 'paid' ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
              ✓ Active subscription
            </p>
          ) : trial?.onTrial ? (
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

        {/* On-Demand Presentation Automation Controls */}
        <AutomationTrigger initialMatchedCount={counts.all} />

        <nav aria-label="Filter by status" className="mt-8 border-b border-slate-200">
          <ul className="-mb-px flex flex-wrap gap-1">
            {TENDER_TABS.map((entry) => (
              <li key={entry.key}>
                <TabLink tab={entry.key} label={entry.label} active={tab} count={counts[entry.key]} />
              </li>
            ))}
          </ul>
        </nav>

        {tendersResult.error ? (
          <div
            role="alert"
            className="mt-8 rounded-lg border border-red-300 bg-red-50 p-5 text-sm leading-relaxed text-red-900"
          >
            Your tenders could not be loaded just now. Reload the page, and if it
            keeps happening let us know.
          </div>
        ) : visible.length === 0 ? (
          <EmptyState tab={tab} totalMatched={counts.all} />
        ) : (
          <ul className="mt-8 space-y-3">
            {visible.map((tender) => {
              const bucket = tenderBucket(tender, today)
              const urgent = bucket !== 'submitted' && isUrgent(tender.deadline, today)

              return (
                <li key={tender.id}>
                  <Link
                    href={`/dashboard/tenders/${tender.id}`}
                    className="block rounded-xl border border-slate-200 p-5 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                      <h2 className="text-base font-semibold text-slate-900">
                        {tender.title ?? 'Untitled tender'}
                      </h2>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${BUCKET_STYLES[bucket]}`}
                      >
                        {BUCKET_LABELS[bucket]}
                      </span>
                    </div>

                    <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-slate-600">
                      <div className="flex gap-1.5">
                        <dt className="text-slate-400">Entity</dt>
                        <dd className="font-medium text-slate-700">
                          {tender.procuring_entity ?? 'Not stated'}
                        </dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt className="text-slate-400">Closes</dt>
                        <dd className="font-medium text-slate-700">
                          {formatDate(tender.deadline)}
                        </dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt className="text-slate-400">Match</dt>
                        <dd className="font-medium text-slate-700">
                          {formatMatchScore(tender.match_score)}
                        </dd>
                      </div>
                      <div
                        className={
                          urgent ? 'font-semibold text-red-700' : 'text-slate-500'
                        }
                      >
                        {deadlinePhrase(tender.deadline, today)}
                      </div>
                    </dl>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}

        {counts.all >= MAX_TENDERS ? (
          <p className="mt-8 text-sm text-slate-500">
            Showing the first {MAX_TENDERS} tenders by deadline. Pagination is not
            built yet.
          </p>
        ) : null}
      </main>
    </div>
  )
}

function TabLink({
  tab,
  label,
  active,
  count,
}: {
  tab: TenderTab
  label: string
  active: TenderTab
  count: number
}) {
  const isActive = tab === active

  return (
    <Link
      href={tab === 'all' ? '/dashboard' : `/dashboard?status=${tab}`}
      aria-current={isActive ? 'page' : undefined}
      className={`inline-flex items-center gap-2 rounded-t-md border-b-2 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
        isActive
          ? 'border-blue-700 text-blue-700'
          : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
          isActive ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
        }`}
      >
        {count}
      </span>
    </Link>
  )
}

function EmptyState({ tab, totalMatched }: { tab: TenderTab; totalMatched: number }) {
  const message =
    totalMatched === 0
      ? 'The matching agent has not run yet. Click "Run Full Automation" or "Find & Match Tenders" in the control bar above to run the AI agent live on-demand.'
      : tab === 'all'
        ? 'Nothing to show.'
        : `No tenders are ${tab} right now.`

  return (
    <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-8">
      <p className="font-semibold text-slate-900">
        {totalMatched === 0 ? 'No matches yet' : 'Nothing in this view'}
      </p>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">{message}</p>
      {totalMatched > 0 && tab !== 'all' ? (
        <p className="mt-4">
          <Link
            href="/dashboard"
            className="rounded-sm text-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
          >
            See all tenders
          </Link>
        </p>
      ) : null}
    </div>
  )
}
