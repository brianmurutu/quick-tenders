import type { ScrapeRunStatus } from '@/types/database'

import { StatusDots } from './svg-sparkline'

type RunSummary = {
  status: ScrapeRunStatus
  tenders_fetched: number | null
  run_at: string
}

const STATUS_BADGE: Record<ScrapeRunStatus, string> = {
  success: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
  partial: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  failed: 'bg-red-50 text-red-800 ring-1 ring-red-200',
}

/**
 * One row in the source-health panel.
 *
 * `recentRuns` should be ordered newest-first; the first element is the most
 * recent run used for the headline figures. All elements are used for the dots
 * sparkline (capped at the last 10).
 */
export function SourceHealthRow({
  source,
  recentRuns,
  successRate7d,
}: {
  source: string
  recentRuns: RunSummary[]
  successRate7d: number | null
}) {
  const latest = recentRuns[0]
  const dotStatuses = recentRuns
    .slice(0, 10)
    .reverse()
    .map((r) => r.status)

  function relativeTime(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime()
    const diffMins = Math.round(diffMs / 60_000)
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHrs = Math.round(diffMins / 60)
    if (diffHrs < 24) return `${diffHrs}h ago`
    return `${Math.round(diffHrs / 24)}d ago`
  }

  return (
    <tr className="border-t border-slate-100">
      <td className="py-3 pr-4 text-sm font-medium text-slate-900">{source}</td>
      <td className="py-3 pr-4">
        {latest ? (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[latest.status]}`}
          >
            {latest.status}
          </span>
        ) : (
          <span className="text-xs text-slate-400">no data</span>
        )}
      </td>
      <td className="py-3 pr-4 text-sm tabular-nums text-slate-700">
        {latest?.tenders_fetched ?? '—'}
      </td>
      <td className="py-3 pr-4 text-xs text-slate-500">
        {latest ? relativeTime(latest.run_at) : '—'}
      </td>
      <td className="py-3 pr-6">
        {dotStatuses.length > 0 ? (
          <StatusDots statuses={dotStatuses} />
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>
      <td className="py-3 text-sm tabular-nums text-slate-700">
        {successRate7d !== null ? `${Math.round(successRate7d * 100)}%` : '—'}
      </td>
    </tr>
  )
}
