/**
 * How a tender is bucketed in the dashboard, and how its dates are phrased.
 *
 * Pure functions, so the list, the tabs and the detail page cannot disagree about
 * what counts as expired.
 */

import type { TenderStatus } from '@/types/database'

/** 'all' is a view, not a stored status. */
export type TenderTab = 'all' | 'new' | 'reviewed' | 'submitted' | 'expired'

export type TenderBucket = Exclude<TenderTab, 'all'>

export const TENDER_TABS: { key: TenderTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'reviewed', label: 'Reviewed' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'expired', label: 'Expired' },
]

export const STATUS_LABELS: Record<TenderStatus, string> = {
  new: 'New',
  reviewed: 'Reviewed',
  submitted: 'Submitted',
  expired: 'Expired',
}

export type BucketableTender = {
  status: TenderStatus
  deadline: string | null
}

/** Today as an ISO calendar date, for string comparison against `deadline`. */
export function isoToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export function isPastDeadline(deadline: string | null, today: string): boolean {
  return deadline !== null && deadline < today
}

/**
 * The one bucket a tender belongs to. Deliberately mutually exclusive, so the tab
 * counts add up to the total and nothing appears twice.
 *
 * Two decisions worth knowing:
 *
 *   - A submitted tender stays under Submitted even once its deadline passes. You
 *     did the work; it should not vanish into Expired.
 *   - A tender still marked new or reviewed whose deadline has passed is shown as
 *     Expired, because it is no longer actionable. Nothing in the pipeline writes
 *     status = 'expired' yet, so without this the Expired tab would always be
 *     empty and closed tenders would sit in New forever.
 */
export function tenderBucket(tender: BucketableTender, today: string): TenderBucket {
  if (tender.status === 'submitted') return 'submitted'
  if (tender.status === 'expired') return 'expired'
  if (isPastDeadline(tender.deadline, today)) return 'expired'

  return tender.status === 'reviewed' ? 'reviewed' : 'new'
}

export function parseTab(raw: string | string[] | undefined): TenderTab {
  const value = Array.isArray(raw) ? raw[0] : raw

  return TENDER_TABS.some((tab) => tab.key === value) ? (value as TenderTab) : 'all'
}

export function countByBucket<T extends BucketableTender>(
  tenders: T[],
  today: string,
): Record<TenderTab, number> {
  const counts: Record<TenderTab, number> = {
    all: tenders.length,
    new: 0,
    reviewed: 0,
    submitted: 0,
    expired: 0,
  }

  for (const tender of tenders) {
    counts[tenderBucket(tender, today)]++
  }

  return counts
}

export function filterByTab<T extends BucketableTender>(
  tenders: T[],
  tab: TenderTab,
  today: string,
): T[] {
  if (tab === 'all') return tenders

  return tenders.filter((tender) => tenderBucket(tender, today) === tab)
}

/** "15 October 2026", stable regardless of server locale. */
export function formatDate(value: string | null): string {
  if (!value) return 'Not stated'

  const parsed = new Date(`${value.slice(0, 10)}T00:00:00Z`)

  if (Number.isNaN(parsed.getTime())) return value

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed)
}

/** Whole days from today to the deadline. Negative once it has passed. */
export function daysUntil(deadline: string | null, today: string): number | null {
  if (!deadline) return null

  const target = new Date(`${deadline.slice(0, 10)}T00:00:00Z`).getTime()
  const from = new Date(`${today}T00:00:00Z`).getTime()

  if (Number.isNaN(target) || Number.isNaN(from)) return null

  return Math.round((target - from) / 86_400_000)
}

/** Short urgency phrase for the list and the detail header. */
export function deadlinePhrase(deadline: string | null, today: string): string {
  const days = daysUntil(deadline, today)

  if (days === null) return 'No closing date'
  if (days < 0) return `Closed ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`
  if (days === 0) return 'Closes today'
  if (days === 1) return 'Closes tomorrow'

  return `${days} days left`
}

/** True when the deadline is close enough to call out. */
export function isUrgent(deadline: string | null, today: string): boolean {
  const days = daysUntil(deadline, today)

  return days !== null && days >= 0 && days <= 7
}

export function formatMatchScore(score: number | null): string {
  if (score === null) return 'Not scored'

  return `${Math.round(score)}%`
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Route params reach Postgres as a uuid comparison, and a non-uuid string makes
 * it raise rather than return no rows. Check the shape first and 404 instead.
 */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value)
}
