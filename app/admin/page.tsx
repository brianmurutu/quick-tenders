import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import type { ScrapeRunStatus } from '@/types/database'

import { AdminResendAuthCard } from './_components/admin-resend-auth-card'
import { SourceHealthRow } from './_components/source-health-row'
import { StatTile } from './_components/stat-tile'
import { SvgSparkline } from './_components/svg-sparkline'

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
  ])

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
}: {
  series: { date: string; count: number }[]
  color: 'blue' | 'green'
  label: string
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
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="mb-3 text-sm font-semibold text-slate-900">{label}</p>
      <SvgSparkline points={points} width={560} height={80} color={color} strokeWidth={2} />
      <div className="mt-1 flex justify-between text-xs text-slate-400">
        <span>{formatDateShort(firstDate)}</span>
        <span>{formatDateShort(lastDate)}</span>
      </div>
    </div>
  )
}

export default async function AdminDashboardPage() {
  const { metrics, signupSeries, tenderSeries, sources } = await fetchDashboardData()

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Platform-wide metrics and pipeline health.</p>
      </div>

      {/* Metric tiles */}
      <section aria-labelledby="metrics-heading">
        <h2 id="metrics-heading" className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Key metrics
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Total companies" value={metrics.companiesTotal} />
          <StatTile
            label="On trial"
            value={metrics.companiesOnTrial}
            accent="blue"
          />
          <StatTile
            label="Past trial"
            value={metrics.companiesPastTrial}
            accent="amber"
          />
          <StatTile
            label="Tenders matched"
            value={metrics.tendersTotal}
            sub="all time"
            accent="green"
          />
          <StatTile
            label="Tenders matched"
            value={metrics.tenders30d}
            sub="last 30 days"
            accent="green"
          />
          <StatTile label="Documents generated" value={metrics.docsTotal} />
        </div>
      </section>

      {/* Auth recovery */}
      <AdminResendAuthCard />

      {/* Trend charts */}
      <section aria-labelledby="trends-heading" className="space-y-4">
        <h2 id="trends-heading" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Trends – last 90 days
        </h2>
        <TrendChart series={signupSeries} color="blue" label="New company sign-ups" />
        <TrendChart series={tenderSeries} color="green" label="Tenders matched" />
      </section>

      {/* Source health panel */}
      <section aria-labelledby="health-heading">
        <h2 id="health-heading" className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Source health – last 14 days
        </h2>

        {sources.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            No scrape-run data in the last 14 days. The discovery cron may not have run yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-3 pr-4 pl-5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Source
                  </th>
                  <th className="py-3 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Last status
                  </th>
                  <th className="py-3 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Fetched
                  </th>
                  <th className="py-3 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Last run
                  </th>
                  <th className="py-3 pr-6 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Last 10 runs
                  </th>
                  <th className="py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
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
    </div>
  )
}
