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
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:24px 16px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:580px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
  <!-- Brand Header -->
  <tr>
    <td style="background:#0f172a;padding:24px 28px;border-bottom:3px solid #1d4ed8;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
        <tr>
          <td>
            <div style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">
              <span style="color:#3b82f6;">⚡</span> Quick Tenders
            </div>
            <div style="font-size:12px;color:#94a3b8;margin-top:4px;">
              Kenya's AI Agent for Tender Discovery &amp; Automated Bid Drafting
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Main Content -->
  <tr><td style="padding:28px;">
    <div style="display:inline-block;padding:4px 10px;background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;border-radius:6px;margin-bottom:16px;">
      New Tender Match
    </div>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#334155;">
      A tender matching <strong>${escapeHtml(input.companyName ?? 'your company')}</strong> has been discovered and initial bid document drafts are ready.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 24px;">
    ${rows
      .map(
        ([label, value]) =>
          `<tr><td style="padding:10px 0;font-size:13px;color:#64748b;width:38%;vertical-align:top;border-bottom:1px solid #f1f5f9;">${label}</td><td style="padding:10px 0;font-size:14px;font-weight:600;color:#0f172a;vertical-align:top;border-bottom:1px solid #f1f5f9;">${value}</td></tr>`,
      )
      .join('\n')}
    </table>

    <div style="padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:0 0 24px;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#475569;">Why it matched</p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#334155;">${escapeHtml(input.summary ?? 'No summary was recorded for this match.')}</p>
    </div>

    ${
      input.documentLabels.length > 0
        ? `<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#059669;font-weight:600;">✓ Drafted for you: ${escapeHtml(input.documentLabels.join(', '))}.</p>`
        : '<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#64748b;">Documents are still being drafted.</p>'
    }

    <p style="margin:0 0 24px;text-align:center;">
      <a href="${escapeHtml(link)}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:700;letter-spacing:-0.01em;box-shadow:0 4px 6px -1px rgba(29,78,216,0.3);">
        Review the documents →
      </a>
    </p>

    ${
      input.sourceUrl
        ? `<p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#64748b;">Original notice: <a href="${escapeHtml(input.sourceUrl)}" style="color:#1d4ed8;text-decoration:underline;">${escapeHtml(input.sourceUrl)}</a></p>`
        : ''
    }

    <p style="margin:0;padding-top:20px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#64748b;">
      These are drafts. Every placeholder needs completing and every statement needs checking before anything is submitted.
    </p>
  </td></tr>

  <!-- Branded Footer -->
  <tr>
    <td style="background:#f8fafc;padding:20px 28px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#64748b;text-align:center;">
      <p style="margin:0 0 6px;font-weight:700;color:#0f172a;">Quick Tenders Kenya</p>
      <p style="margin:0 0 6px;">Automated procurement monitoring across PPIP (tenders.go.ke), GAA &amp; 47 Counties.</p>
      <p style="margin:0;">
        <a href="https://quicktenders.co.ke" style="color:#1d4ed8;text-decoration:none;font-weight:600;">quicktenders.co.ke</a> &bull;
        <a href="https://quicktenders.co.ke/dashboard" style="color:#1d4ed8;text-decoration:none;font-weight:600;">Dashboard</a> &bull;
        <a href="mailto:notifications@quicktenders.co.ke" style="color:#1d4ed8;text-decoration:none;">Support</a>
      </p>
    </td>
  </tr>
</table>
</body>
</html>`

  return { subject, html, text }
}
