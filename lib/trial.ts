/**
 * Trial window evaluation, kept as a pure function so the dashboard guard and
 * the pages that display remaining time cannot drift apart.
 */

export const TRIAL_DAYS = 3

const MS_PER_DAY = 24 * 60 * 60 * 1000

export type TrialCompany = {
  plan: string
  trial_ends_at: string
}

export type TrialState = {
  /** True when access to the product should be blocked. */
  expired: boolean
  /** False once the company is on a paid plan, whatever the dates say. */
  onTrial: boolean
  endsAt: Date | null
  msRemaining: number
  /** Whole days remaining, rounded up. 0 once the window has closed. */
  daysRemaining: number
}

export function trialState(company: TrialCompany, now: Date = new Date()): TrialState {
  const onTrial = company.plan === 'trial'

  // Paid plans never expire.
  if (!onTrial) {
    return {
      expired: false,
      onTrial: false,
      endsAt: null,
      msRemaining: 0,
      daysRemaining: 0,
    }
  }

  const endsAtMs = new Date(company.trial_ends_at).getTime()

  // An unparseable end date on a trial plan fails closed. Granting access
  // because a timestamp could not be read is the wrong way round.
  if (Number.isNaN(endsAtMs)) {
    return {
      expired: onTrial,
      onTrial,
      endsAt: null,
      msRemaining: 0,
      daysRemaining: 0,
    }
  }

  const msRemaining = endsAtMs - now.getTime()

  return {
    expired: onTrial && msRemaining <= 0,
    onTrial,
    endsAt: new Date(endsAtMs),
    msRemaining,
    daysRemaining: Math.max(0, Math.ceil(msRemaining / MS_PER_DAY)),
  }
}

/** "26 August 2026", stable regardless of the server locale. */
export function formatTrialDate(date: Date | null): string {
  if (!date) return 'an unknown date'

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}
