/**
 * The "new tender matched" email.
 *
 * Kept as a pure function of its input so it can be tested without sending
 * anything. Every interpolated value is escaped: tender titles and procuring
 * entity names come from scraped or imported third party sources, so they are
 * untrusted strings heading into an HTML document.
 */

import { getSiteUrl } from '@/lib/env'

export type TenderEmailInput = {
  tenderId: string
  title: string
  procuringEntity: string | null
  deadline: string | null
  matchScore: number | null
  summary: string | null
  sourceUrl: string | null
  companyName: string | null
  representativeName: string | null
  documentLabels: string[]
}

export type BuiltEmail = {
  subject: string
  html: string
  text: string
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * The dashboard route for one tender.
 *
 * This intentionally points at /dashboard/tenders/[id], which does not exist
 * yet. The link is correct for where that page will live, so no email has to be
 * rewritten later. Until the route ships, following it lands on the dashboard
 * 404 rather than anything broken or misleading.
 */
export function reviewUrl(tenderId: string): string {
  return `${getSiteUrl()}/dashboard/tenders/${encodeURIComponent(tenderId)}`
}

function formatDeadline(deadline: string | null): string {
  if (!deadline) return 'not stated'

  const parsed = new Date(`${deadline}T00:00:00Z`)

  if (Number.isNaN(parsed.getTime())) return deadline

  const formatted = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed)

  const days = Math.ceil((parsed.getTime() - Date.now()) / 86_400_000)

  if (days < 0) return `${formatted} (already closed)`
  if (days === 0) return `${formatted} (today)`
  if (days === 1) return `${formatted} (tomorrow)`

  return `${formatted} (${days} days away)`
}

export function buildTenderEmail(input: TenderEmailInput): BuiltEmail {
  const entity = input.procuringEntity ?? 'an unnamed procuring entity'
  const deadline = formatDeadline(input.deadline)
  const link = reviewUrl(input.tenderId)
  const greeting = input.representativeName
    ? `Hello ${input.representativeName},`
    : 'Hello,'
  const score =
    input.matchScore === null ? null : `${Math.round(input.matchScore)}% match`

  const subject = `New tender match: ${input.title}`

  const textLines = [
    greeting,
    '',
    score
      ? `A new tender matched your profile (${score}).`
      : 'A new tender matched your profile.',
    '',
    `Tender:           ${input.title}`,
    `Procuring entity: ${entity}`,
    `Closing:          ${deadline}`,
    '',
    'Why it matched:',
    input.summary ?? 'No summary was recorded for this match.',
    '',
    input.documentLabels.length > 0
      ? `Drafted for you: ${input.documentLabels.join(', ')}.`
      : 'Documents are still being drafted.',
    '',
    'Review the documents:',
    link,
    '',
    input.sourceUrl ? `Original notice: ${input.sourceUrl}` : '',
    '',
    'These are drafts. Every placeholder needs completing and every statement',
    'needs checking before anything is submitted.',
    '',
    'Quick Tenders',
  ]

  const text = textLines.filter((line, index) => line !== '' || textLines[index - 1] !== '')
    .join('\n')

  const rows = [
    ['Tender', escapeHtml(input.title)],
    ['Procuring entity', escapeHtml(entity)],
    ['Closing', escapeHtml(deadline)],
    ...(score ? [['Match', escapeHtml(score)]] : []),
  ]

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f8fafc;font-family:ui-sans-serif,system-ui,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
<tr><td style="padding:28px;">
<p style="margin:0 0 18px;font-size:12px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#1d4ed8;">New tender match</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;">${escapeHtml(greeting)}</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;">A tender matching ${escapeHtml(input.companyName ?? 'your company')} has been found and a first draft of the paperwork is ready.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 24px;">
${rows
  .map(
    ([label, value]) =>
      `<tr><td style="padding:8px 0;font-size:13px;color:#64748b;width:38%;vertical-align:top;">${label}</td><td style="padding:8px 0;font-size:14px;font-weight:600;vertical-align:top;">${value}</td></tr>`,
  )
  .join('\n')}
</table>
<div style="padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:0 0 24px;">
<p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#64748b;">Why it matched</p>
<p style="margin:0;font-size:14px;line-height:1.6;">${escapeHtml(input.summary ?? 'No summary was recorded for this match.')}</p>
</div>
${
  input.documentLabels.length > 0
    ? `<p style="margin:0 0 24px;font-size:14px;line-height:1.6;">Drafted for you: ${escapeHtml(input.documentLabels.join(', '))}.</p>`
    : '<p style="margin:0 0 24px;font-size:14px;line-height:1.6;">Documents are still being drafted.</p>'
}
<p style="margin:0 0 24px;"><a href="${escapeHtml(link)}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-size:15px;font-weight:600;">Review the documents</a></p>
${
  input.sourceUrl
    ? `<p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#64748b;">Original notice: <a href="${escapeHtml(input.sourceUrl)}" style="color:#1d4ed8;">${escapeHtml(input.sourceUrl)}</a></p>`
    : ''
}
<p style="margin:0;padding-top:20px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#64748b;">These are drafts. Every placeholder needs completing and every statement needs checking before anything is submitted.</p>
</td></tr>
</table>
</body>
</html>`

  return { subject, html, text }
}
