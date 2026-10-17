import type { Metadata } from 'next'
import Link from 'next/link'

import { aiConfigured } from '@/lib/ai'
import { paystackConfigured } from '@/lib/paystack'
import { createClient } from '@/lib/supabase/server'
import { textSmsConfigured, textSmsConfigHint } from '@/lib/sms/textsms'
import type { ScrapeRunStatus } from '@/types/database'

import { AdminResendAuthCard } from './_components/admin-resend-auth-card'
import { SourceHealthRow } from './_components/source-health-row'
import { StatTile } from './_components/stat-tile'
import { SvgSparkline } from './_components/svg-sparkline'
import AdminEmailActionsCard from './_components/email-actions-card'

export const metadata: Metadata = {
  title: 'Admin Dashboard | Quick Tenders',
}

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** ISO date string, UTC, 'YYYY-MM-DD'. */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Returns an ISO date string N days before today. */
function daysAgo(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return isoDate(d)
}

/**
 * Fills in missing dates in a sparse date→count map so sparkline arrays have
 * a continuous x-axis over `days` days ending today.
 */
function fillDailyCounts(
  sparse: Record<string, number>,
  days: number,
): { date: string; count: number }[] {
  const result: { date: string; count: number }[] = []
  const now = new Date()

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - i)
    const key = isoDate(d)
    result.push({ date: key, count: sparse[key] ?? 0 })
  }

  return result
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchDashboardData() {
  const supabase = createClient()

  const cutoff90 = daysAgo(90)
  const cutoff30 = daysAgo(30)
  const cutoff7 = daysAgo(7)
  const now = new Date().toISOString()

  const [
    companiesTotal,
    companiesOnTrial,
    companiesPastTrial,
    tendersTotal,
    tenders30d,
    docsTotal,
    companiesSignupRows,
    tendersMatchedRows,
    scrapeRunRows,
    recipientCompanies,
    recipientRepresentatives,
  ] = await Promise.all([
    // --- Metric tiles ---
    supabase.from('companies').select('id', { count: 'exact', head: true }),
    supabase
      .from('companies')
      .select('id', { count: 'exact', head: true })
      .eq('plan', 'trial')
      .gt('trial_ends_at', now),
    supabase
      .from('companies')
      .select('id', { count: 'exact', head: true })
      .eq('plan', 'trial')
      .lte('trial_ends_at', now),
    supabase.from('tenders_matched').select('id', { count: 'exact', head: true }),
    supabase
      .from('tenders_matched')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', cutoff30),
    supabase.from('tender_documents').select('id', { count: 'exact', head: true }),

    // --- Trend charts: raw created_at for buckets (last 90 days) ---
    supabase
      .from('companies')
      .select('created_at')
      .gte('created_at', cutoff90)
      .order('created_at', { ascending: true }),
    supabase
      .from('tenders_matched')
      .select('created_at')
      .gte('created_at', cutoff90)
      .order('created_at', { ascending: true }),

    // --- Source health: last 14 days of scrape_runs ---
    supabase
      .from('scrape_runs')
      .select('source, status, tenders_fetched, run_at')
      .gte('run_at', daysAgo(14))
      .order('run_at', { ascending: false })
      .limit(500),
    fetchRecipientCompanies(supabase),
    fetchRecipientRepresentatives(supabase),
  ])

  if (scrapeRunRows.error) {
    throw new Error(`Could not load scrape-run health: ${scrapeRunRows.error.message}`)
  }

  // --- Build daily buckets for trend charts ---
  const signupBucket: Record<string, number> = {}
  for (const row of companiesSignupRows.data ?? []) {
    const key = row.created_at.slice(0, 10)
    signupBucket[key] = (signupBucket[key] ?? 0) + 1
  }

  const tenderBucket: Record<string, number> = {}
  for (const row of tendersMatchedRows.data ?? []) {
    const key = row.created_at.slice(0, 10)
    tenderBucket[key] = (tenderBucket[key] ?? 0) + 1
  }

  const signupSeries = fillDailyCounts(signupBucket, 90)
  const tenderSeries = fillDailyCounts(tenderBucket, 90)

  // --- Group scrape_runs by source ---
  type RunRow = { source: string | null; status: ScrapeRunStatus; tenders_fetched: number | null; run_at: string }
  const allRuns: RunRow[] = (scrapeRunRows.data ?? []) as RunRow[]

  const sourceMap = new Map<
    string,
    { runs: { status: ScrapeRunStatus; tenders_fetched: number | null; run_at: string }[] }
  >()

  for (const run of allRuns) {
    const src = run.source ?? '(unknown)'
    if (!sourceMap.has(src)) sourceMap.set(src, { runs: [] })
    sourceMap.get(src)!.runs.push({
      status: run.status,
      tenders_fetched: run.tenders_fetched,
      run_at: run.run_at,
    })
  }

  // Compute 7-day success rate per source
  const sources = Array.from(sourceMap.entries()).map(([source, { runs }]) => {
    const runs7d = runs.filter((r) => r.run_at >= cutoff7)
    const successRate7d =
      runs7d.length > 0
        ? runs7d.filter((r) => r.status === 'success').length / runs7d.length
        : null

    return { source, recentRuns: runs, successRate7d }
  })

  return {
    metrics: {
      companiesTotal: companiesTotal.count ?? 0,
      companiesOnTrial: companiesOnTrial.count ?? 0,
      companiesPastTrial: companiesPastTrial.count ?? 0,
      tendersTotal: tendersTotal.count ?? 0,
      tenders30d: tenders30d.count ?? 0,
      docsTotal: docsTotal.count ?? 0,
    },
    signupSeries,
    tenderSeries,
    sources,
    recipientCompanies,
    recipientRepresentatives,
    integrations: {
      matching: aiConfigured(),
      payments: paystackConfigured(),
      sms: textSmsConfigured(),
    },
  }
}

async function fetchRecipientCompanies(supabase: ReturnType<typeof createClient>) {
  const rows: { id: string; name: string | null; domain: string }[] = []

  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from('companies')
      .select('id, name, domain')
      .order('name', { ascending: true })
      .range(offset, offset + 999)

    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) return rows
  }
}

async function fetchRecipientRepresentatives(
  supabase: ReturnType<typeof createClient>,
) {
  const rows: {
    id: string
    company_id: string | null
    full_name: string | null
    email: string
    phone_number: string | null
  }[] = []

  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from('representatives')
      .select('id, company_id, full_name, email, phone_number')
      .order('created_at', { ascending: true })
      .range(offset, offset + 999)

    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) return rows
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/** Renders a simple SVG line chart with a date-axis label on first/last. */
function TrendChart({
  series,
  color,
  label,
  className,
}: {
  series: { date: string; count: number }[]
  color: 'blue' | 'green'
  label: string
  className?: string
}) {
  const points = series.map((d) => d.count)
  const firstDate = series[0]?.date ?? ''
  const lastDate = series[series.length - 1]?.date ?? ''

  function formatDateShort(iso: string): string {
    if (!iso) return ''
    const [, month, day] = iso.split('-')
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${MONTHS[parseInt(month, 10) - 1]} ${parseInt(day, 10)}`
  }

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 ${className ?? ''}`}>
      <p className="mb-3 text-sm font-semibold text-slate-900 text-balance">{label}</p>
      <SvgSparkline
        points={points}
        width={560}
        height={80}
        color={color}
        strokeWidth={2}
        className="block h-20 w-full"
      />
      <div className="mt-1 flex justify-between text-xs text-slate-400">
        <span>{formatDateShort(firstDate)}</span>
        <span>{formatDateShort(lastDate)}</span>
      </div>
    </div>
  )
}

export default async function AdminDashboardPage() {
  const {
    metrics,
    signupSeries,
    tenderSeries,
    sources,
    recipientCompanies,
    recipientRepresentatives,
    integrations,
  } = await fetchDashboardData()

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-emerald-800">Quick Tenders admin</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 text-balance">Overview</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 text-pretty">
            Platform metrics, tender-source health, and the tools used to support companies.
          </p>
        </div>
        <Link
          href="/admin/companies"
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-forest px-4 text-sm font-semibold text-white outline-offset-2 hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest"
        >
          View users
        </Link>
      </div>

      {/* Metric tiles */}
      <section aria-labelledby="metrics-heading">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="metrics-heading" className="text-lg font-semibold text-slate-900 text-balance">
            Platform snapshot
          </h2>
          <span className="text-xs text-slate-500">Live account and pipeline totals</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12">
          <div className="xl:col-span-2">
            <StatTile label="Total companies" value={metrics.companiesTotal} />
          </div>
          <div className="xl:col-span-2">
            <StatTile label="On trial" value={metrics.companiesOnTrial} accent="blue" />
          </div>
          <div className="xl:col-span-2">
            <StatTile label="Past trial" value={metrics.companiesPastTrial} accent="amber" />
          </div>
          <div className="xl:col-span-2">
            <StatTile
              label="Tenders matched"
              value={metrics.tendersTotal}
              sub="All time"
              accent="green"
            />
          </div>
          <div className="xl:col-span-2">
            <StatTile
              label="Tenders matched"
              value={metrics.tenders30d}
              sub="Last 30 days"
              accent="green"
            />
          </div>
          <div className="xl:col-span-2">
            <StatTile label="Documents generated" value={metrics.docsTotal} />
          </div>
        </div>
      </section>

      {/* Trend charts */}
      <section
        id="analytics"
        aria-labelledby="trends-heading"
        className="grid grid-cols-1 gap-4 lg:grid-cols-12"
      >
        <div className="lg:col-span-12">
          <h2
            id="trends-heading"
            className="text-lg font-semibold text-slate-900 text-balance"
          >
            Activity trends
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Daily activity over the last 90 days.
          </p>
        </div>
        <TrendChart
          series={signupSeries}
          color="blue"
          label="New company sign-ups"
          className="min-w-0 lg:col-span-6"
        />
        <TrendChart
          series={tenderSeries}
          color="green"
          label="Tenders matched"
          className="min-w-0 lg:col-span-6"
        />
      </section>

      {/* Source health panel */}
      <section id="sources" aria-labelledby="health-heading" className="min-w-0">
        <div className="mb-4">
          <h2 id="health-heading" className="text-lg font-semibold text-slate-900 text-balance">
            Tender-source health
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Discovery results from the last 14 days.
          </p>
        </div>

        {sources.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            No discovery runs are recorded in the last 14 days. The cron may not
            have run, or its results may not have been saved. Check the Vercel
            logs if this persists.
          </div>
        ) : (
          <div className="responsive-table rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="py-3 pr-4 pl-5 text-xs font-semibold uppercase text-slate-500">
                    Source
                  </th>
                  <th className="py-3 pr-4 text-xs font-semibold uppercase text-slate-500">
                    Last status
                  </th>
                  <th className="py-3 pr-4 text-xs font-semibold uppercase text-slate-500">
                    Fetched
                  </th>
                  <th className="py-3 pr-4 text-xs font-semibold uppercase text-slate-500">
                    Last run
                  </th>
                  <th className="py-3 pr-6 text-xs font-semibold uppercase text-slate-500">
                    Last 10 runs
                  </th>
                  <th className="py-3 text-xs font-semibold uppercase text-slate-500">
                    7-day success
                  </th>
                </tr>
              </thead>
              <tbody>
                {sources.map(({ source, recentRuns, successRate7d }) => (
                  <SourceHealthRow
                    key={source}
                    source={source}
                    recentRuns={recentRuns}
                    successRate7d={successRate7d}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section id="settings" aria-labelledby="settings-heading">
        <div className="mb-4">
          <h2
            id="settings-heading"
            className="text-lg font-semibold text-slate-900 text-balance"
          >
            Settings and integrations
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Configuration status only. Credentials are never shown here.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <IntegrationStatus label="Tender matching" ready={integrations.matching} />
          <IntegrationStatus label="Payments" ready={integrations.payments} />
          <IntegrationStatus label="SMS" ready={integrations.sms} />
        </div>
      </section>

      <section id="support" aria-labelledby="support-heading" className="space-y-4">
        <div>
          <h2
            id="support-heading"
            className="text-lg font-semibold text-slate-900 text-balance"
          >
            Support and communications
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Help customers regain access or contact the Quick Tenders support team.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-900">Contact support</p>
          <p className="mt-1 text-sm text-slate-600 text-pretty">
            For customer or platform issues, email the support team.
          </p>
          <a
            href="mailto:support@quicktenders.co.ke"
            className="mt-3 inline-flex min-h-10 items-center rounded-md font-semibold text-emerald-800 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            support@quicktenders.co.ke
          </a>
        </div>
        <AdminResendAuthCard />
        <AdminEmailActionsCard
          companies={recipientCompanies}
          representatives={recipientRepresentatives}
          smsConfigured={integrations.sms}
          smsConfigurationHint={textSmsConfigHint()}
        />
      </section>
    </div>
  )
}

function IntegrationStatus({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex min-h-24 items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5">
      <div>
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="mt-1 text-xs text-slate-500">
          {ready ? 'Configured' : 'Configuration required'}
        </p>
      </div>
      <span
        data-ready={ready}
        className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 data-[ready=true]:bg-emerald-50 data-[ready=true]:text-emerald-900"
      >
        {ready ? 'Ready' : 'Needs setup'}
      </span>
    </div>
  )
}
