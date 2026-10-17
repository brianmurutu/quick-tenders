import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

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
import { CronScheduleCard } from './cron-schedule-card'

export const metadata: Metadata = {
  title: 'Dashboard | Quick Tenders',
  description: 'Matched tenders for your company.',
}

/** Per representative and gated on a live trial. See app/dashboard/layout.tsx. */
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20
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
  searchParams: { status?: string | string[]; page?: string | string[] }
}) {
  const supabase = createClient()
  const tab = parseTab(searchParams.status)
  const rawPage = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page
  const requestedPage = rawPage && /^\d+$/.test(rawPage) ? Number(rawPage) : 1
  const page =
    Number.isSafeInteger(requestedPage) &&
    requestedPage > 0 &&
    requestedPage <= Math.floor(Number.MAX_SAFE_INTEGER / PAGE_SIZE)
      ? requestedPage
      : 1
  const today = isoToday()

  // Keep the original single-page read pattern; paginate the returned set below.
  // RLS scopes this query to the caller's company.
  const [companyResult, repResult, tendersResult] = await Promise.all([
    supabase
      .from('companies')
      .select('id, name, plan, trial_ends_at, sectors_of_interest, industry')
      .limit(1)
      .maybeSingle(),
    supabase
      .from('representatives')
      .select('id, full_name, email, phone_number')
      .limit(1)
      .maybeSingle(),
    supabase
      .from('tenders_matched')
      .select('id, title, procuring_entity, deadline, match_score, status')
      .order('deadline', { ascending: true, nullsFirst: false })
      .order('match_score', { ascending: false, nullsFirst: false })
      .limit(MAX_TENDERS),
  ])

  const company = companyResult.data
  const rep = repResult.data
  const tenders = tendersResult.data ?? []
  const counts = countByBucket(tenders, today)
  const filteredTenders = filterByTab(tenders, tab, today)
  const totalPages = Math.max(1, Math.ceil(filteredTenders.length / PAGE_SIZE))
  const visibleTenders = filteredTenders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const loadError = tendersResult.error
  const trial = company ? trialState(company) : null

  if (!loadError && page > totalPages) {
    redirect(dashboardHref(tab, totalPages))
  }

  return (
    <div className="user-dashboard">
      <AppHeader right={company?.name ?? undefined} showLogo={false} />

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

        {/* On-Demand Interactive Custom Sector & Automation Controls */}
        <div id="automation" className="scroll-mt-24">
          <AutomationTrigger
            initialMatchedCount={counts.all}
            companyProfileSectors={company?.sectors_of_interest ?? []}
            representativePhone={rep?.phone_number}
            representativeEmail={rep?.email}
          />
        </div>

        {/* Automated Background AI Schedule (Cron) Settings */}
        <CronScheduleCard />

        <nav aria-label="Filter by status" className="mt-8 border-b border-slate-200">
          <ul className="-mb-px flex flex-wrap gap-1">
            {TENDER_TABS.map((entry) => (
              <li key={entry.key}>
                <TabLink tab={entry.key} label={entry.label} active={tab} count={counts[entry.key]} />
              </li>
            ))}
          </ul>
        </nav>

        {loadError ? (
          <div
            role="alert"
            className="mt-8 rounded-lg border border-red-300 bg-red-50 p-5 text-sm leading-relaxed text-red-900"
          >
            Your tenders could not be loaded just now. Reload the page, and if it
            keeps happening let us know.
          </div>
        ) : filteredTenders.length === 0 ? (
          <EmptyState tab={tab} totalMatched={counts.all} />
        ) : (
          <ul className="mt-8 space-y-3">
            {visibleTenders.map((tender) => {
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

        {!loadError && counts[tab] > 0 ? (
          <Pagination
            tab={tab}
            page={page}
            totalPages={totalPages}
            totalCount={filteredTenders.length}
            pageCount={visibleTenders.length}
          />
        ) : null}

        {tenders.length === MAX_TENDERS ? (
          <p className="mt-4 text-sm text-slate-500">
            Showing pages from the latest {MAX_TENDERS} tenders. Contact support if you need help locating an older match.
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

function dashboardHref(tab: TenderTab, page: number) {
  const params = new URLSearchParams()
  if (tab !== 'all') params.set('status', tab)
  if (page > 1) params.set('page', String(page))
  const query = params.toString()
  return query ? `/dashboard?${query}` : '/dashboard'
}

function Pagination({
  tab,
  page,
  totalPages,
  totalCount,
  pageCount,
}: {
  tab: TenderTab
  page: number
  totalPages: number
  totalCount: number
  pageCount: number
}) {
  const firstPage = Math.max(1, Math.min(page - 2, totalPages - 4))
  const lastPage = Math.min(totalPages, firstPage + 4)
  const pages = Array.from({ length: lastPage - firstPage + 1 }, (_, index) => firstPage + index)
  const firstItem = (page - 1) * PAGE_SIZE + 1
  const lastItem = firstItem + pageCount - 1

  return (
    <div className="mt-8 flex flex-col gap-4 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-600 tabular-nums">
        Showing {firstItem}–{lastItem} of {totalCount} tenders
      </p>
      {totalPages > 1 ? (
        <nav aria-label="Tender pages" className="flex flex-wrap items-center gap-1">
          {page === 1 ? (
            <span
              aria-disabled="true"
              className="inline-flex min-h-10 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 opacity-50"
            >
              Previous
            </span>
          ) : (
            <Link
              href={dashboardHref(tab, page - 1)}
              className="inline-flex min-h-10 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Previous
            </Link>
          )}
          {pages.map((pageNumber) => (
            <Link
              key={pageNumber}
              href={dashboardHref(tab, pageNumber)}
              aria-current={pageNumber === page ? 'page' : undefined}
              aria-label={`Page ${pageNumber}`}
              className="inline-flex size-10 items-center justify-center rounded-md text-sm font-medium tabular-nums text-slate-700 hover:bg-slate-100 aria-[current=page]:bg-blue-700 aria-[current=page]:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              {pageNumber}
            </Link>
          ))}
          {page === totalPages ? (
            <span
              aria-disabled="true"
              className="inline-flex min-h-10 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 opacity-50"
            >
              Next
            </span>
          ) : (
            <Link
              href={dashboardHref(tab, page + 1)}
              className="inline-flex min-h-10 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Next
            </Link>
          )}
        </nav>
      ) : null}
    </div>
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
