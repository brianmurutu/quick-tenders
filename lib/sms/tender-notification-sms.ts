/**
 * SMS notification for a new tender match.
 *
 * Kept short because SMS has a 160-char limit per part. The message includes
 * the tender title (truncated), closing date, and a link to the dashboard.
 */

import { getSiteUrl } from '@/lib/env'
import { sendSms, type SendSmsResult } from './textsms'

export type TenderSmsInput = {
  tenderId: string
  title: string | null
  deadline: string | null
  companyName: string | null
}

/** Builds the SMS text, staying within 160 characters where possible. */
export function buildTenderSmsText(input: TenderSmsInput): string {
  const site = getSiteUrl()
  const url = `${site}/dashboard/tenders/${encodeURIComponent(input.tenderId)}`

  const title = (input.title ?? 'New tender').slice(0, 60)

  const deadlinePart = input.deadline
    ? ` | Closes ${formatSmsDeadline(input.deadline)}`
    : ''

  // Build: "QuickTenders: <title><deadline> | Review: <url>"
  const message = `QuickTenders: ${title}${deadlinePart} | Review: ${url}`

  // If still > 160 chars (long URL), truncate title further
  if (message.length <= 160) return message

  const overflow = message.length - 160
  const shorterTitle = title.slice(0, Math.max(10, title.length - overflow - 3)) + '...'
  return `QuickTenders: ${shorterTitle}${deadlinePart} | Review: ${url}`
}

function formatSmsDeadline(deadline: string): string {
  // deadline is ISO date string e.g. "2026-09-15"
  const parsed = new Date(`${deadline}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return deadline

  const days = Math.ceil((parsed.getTime() - Date.now()) / 86_400_000)
  if (days < 0) return `${deadline} (closed)`
  if (days === 0) return `today`
  if (days === 1) return `tomorrow`
  return `${deadline} (${days}d)`
}

export async function sendTenderNotificationSms(
  input: TenderSmsInput,
  phoneNumbers: string[],
): Promise<SendSmsResult> {
  if (phoneNumbers.length === 0) {
    return { ok: false, error: 'No phone numbers provided' }
  }

  const message = buildTenderSmsText(input)
  return sendSms({ to: phoneNumbers, message })
}
