/**
 * Discovery run notifications for tenants.
 *
 * Dispatches email (Resend) and SMS (TextSMS) to company representatives
 * after an automated or on-demand tender discovery scan.
 * Handles both:
 *  - Matches found (>0 matches above threshold)
 *  - No matches found (0 matches above threshold), with details of sectors checked
 *    and when the next scheduled cronjob will run.
 */

import { getSiteUrl } from '@/lib/env'
import { resendConfigured, sendEmail } from '@/lib/email/resend'
import { textSmsConfigured, sendSms } from '@/lib/sms/textsms'
import { createAdminClient, type SupabaseAdminClient } from '@/lib/supabase/admin'

export type MatchedTenderBrief = {
  id?: string
  title: string
  procuringEntity: string | null
  deadline: string | null
  matchScore: number
  summary?: string
}

export type NotifyRunSummaryInput = {
  companyId: string
  companyName: string | null
  sectorsChecked: string[]
  tendersScanned: number
  matchedCount: number
  topScore: number | null
  matchedTenders?: MatchedTenderBrief[]
  nextRunDescription?: string
}

export type NotifyRunResult = {
  emailSent: boolean
  smsSent: boolean
  recipientsCount: number
  errors: string[]
}

/** Formats next run phrase, defaulting to daily morning schedule */
export function defaultNextRunPhrase(): string {
  // Cron is set to 04:23 UTC daily (07:23 EAT)
  const now = new Date()
  const eatOffsetHours = 3
  const eatNow = new Date(now.getTime() + eatOffsetHours * 3600 * 1000)

  const isBeforeScanToday = eatNow.getUTCHours() < 7 || (eatNow.getUTCHours() === 7 && eatNow.getUTCMinutes() < 23)

  if (isBeforeScanToday) {
    return 'Today at 07:23 EAT (04:23 UTC)'
  }
  return 'Tomorrow at 07:23 EAT (04:23 UTC)'
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function sendRunCompletionNotification(
  input: NotifyRunSummaryInput,
  supabaseClient?: SupabaseAdminClient,
): Promise<NotifyRunResult> {
  const result: NotifyRunResult = {
    emailSent: false,
    smsSent: false,
    recipientsCount: 0,
    errors: [],
  }

  const supabase = supabaseClient ?? createAdminClient()

  // 1. Fetch representatives for this company
  const { data: reps, error: repError } = await supabase
    .from('representatives')
    .select('full_name, email, phone_number')
    .eq('company_id', input.companyId)

  if (repError || !reps || reps.length === 0) {
    result.errors.push(`No representatives found for company ${input.companyId}`)
    return result
  }

  const emails = Array.from(new Set(reps.map((r) => r.email).filter(Boolean))) as string[]
  const phones = Array.from(new Set(reps.map((r) => r.phone_number).filter(Boolean))) as string[]

  result.recipientsCount = emails.length + phones.length
  const primaryName = reps[0].full_name || 'Valued Partner'
  const companyName = input.companyName || 'your company'
  const nextRun = input.nextRunDescription || defaultNextRunPhrase()
  const siteUrl = getSiteUrl()
  const dashboardUrl = `${siteUrl}/dashboard`
  const sectorsStr = input.sectorsChecked.length > 0 ? input.sectorsChecked.join(', ') : 'All general sectors'

  // --- CASE 1: MATCHES FOUND (> 0) ---
  if (input.matchedCount > 0) {
    const subject = `Quick Tenders: ${input.matchedCount} New Tender Match${input.matchedCount === 1 ? '' : 'es'} for ${companyName}`

    const topTendersHtml = (input.matchedTenders || [])
      .slice(0, 5)
      .map((t) => {
        const isTopMatch = t.matchScore >= 80
        const badgeBg = isTopMatch ? '#dcfce7' : '#dbeafe'
        const badgeColor = isTopMatch ? '#15803d' : '#1d4ed8'

        return `
        <div style="padding:16px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,0.02);">
          <div style="font-weight:700;font-size:15px;color:#0f172a;line-height:1.4;margin-bottom:6px;">
            ${escapeHtml(t.title)}
          </div>
          <div style="font-size:13px;color:#64748b;margin-bottom:10px;">
            <strong style="color:#334155;">${escapeHtml(t.procuringEntity || 'Procuring Entity')}</strong> &bull; Deadline: <strong style="color:#0f172a;">${escapeHtml(t.deadline || 'Open')}</strong>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
            <span style="display:inline-block;padding:3px 10px;border-radius:9999px;font-size:12px;font-weight:700;background:${badgeBg};color:${badgeColor};">
              ${t.matchScore}% Compatibility
            </span>
            <span style="font-size:12px;color:#059669;font-weight:600;">
              ✓ First-draft bid documents ready
            </span>
          </div>
        </div>
      `
      })
      .join('')

    const emailHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:24px 12px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
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

    <!-- Body Content -->
    <tr>
      <td style="padding:28px;">
        <div style="display:inline-block;padding:4px 10px;background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;border-radius:6px;margin-bottom:16px;">
          New Match Alert
        </div>

        <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#0f172a;">Hello ${escapeHtml(primaryName)},</h2>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">
          Our automated discovery engine identified <strong>${input.matchedCount} new matching tender opportunit${input.matchedCount === 1 ? 'y' : 'ies'}</strong> for <strong>${escapeHtml(companyName)}</strong> with a top match score of <strong>${input.topScore ?? 0}%</strong>.
        </p>

        <!-- Metric Highlight Bar -->
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px;border-collapse:collapse;">
          <tr>
            <td style="padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;text-align:center;width:50%;">
              <div style="font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;">New Matches</div>
              <div style="font-size:22px;font-weight:800;color:#1d4ed8;margin-top:2px;">${input.matchedCount}</div>
            </td>
            <td style="width:12px;"></td>
            <td style="padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;text-align:center;width:50%;">
              <div style="font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;">Top Compatibility</div>
              <div style="font-size:22px;font-weight:800;color:#059669;margin-top:2px;">${input.topScore ?? 0}%</div>
            </td>
          </tr>
        </table>

        <!-- Tenders List -->
        <div style="margin:0 0 24px;">
          <div style="font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#475569;margin-bottom:12px;">
            Top Matched Opportunities
          </div>
          ${topTendersHtml}
        </div>

        <!-- Callout Banner -->
        <div style="padding:14px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;margin-bottom:24px;font-size:13px;line-height:1.6;color:#1e40af;">
          <strong>📄 Automated Bid Documents:</strong> First-draft Cover Letters and Technical Proposal skeletons are being compiled for you. You can review, edit, and download them directly from your dashboard.
        </div>

        <!-- Scan Meta Info -->
        <div style="padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:28px;font-size:13px;line-height:1.6;color:#64748b;">
          <div>&bull; <strong>Sectors analyzed:</strong> ${escapeHtml(sectorsStr)}</div>
          <div>&bull; <strong>Next automated scan:</strong> <span style="color:#0f172a;font-weight:600;">${escapeHtml(nextRun)}</span></div>
        </div>

        <!-- CTA Button -->
        <div style="text-align:center;margin-bottom:16px;">
          <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:700;letter-spacing:-0.01em;box-shadow:0 4px 6px -1px rgba(29,78,216,0.3);">
            Review Tenders &amp; Download Proposals →
          </a>
        </div>
      </td>
    </tr>

    <!-- Branded Footer -->
    <tr>
      <td style="background:#f8fafc;padding:20px 28px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#64748b;text-align:center;">
        <p style="margin:0 0 6px;font-weight:700;color:#0f172a;">Quick Tenders Kenya</p>
        <p style="margin:0 0 6px;">Automated procurement monitoring across PPIP (tenders.go.ke), GAA &amp; 47 Counties.</p>
        <p style="margin:0;">
          <a href="https://quicktenders.co.ke" style="color:#1d4ed8;text-decoration:none;font-weight:600;">quicktenders.co.ke</a> &bull;
          <a href="${escapeHtml(dashboardUrl)}" style="color:#1d4ed8;text-decoration:none;font-weight:600;">Dashboard</a> &bull;
          <a href="mailto:notifications@quicktenders.co.ke" style="color:#1d4ed8;text-decoration:none;">Support</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`

    const emailText = `Hello ${primaryName},

Our automated discovery scan found ${input.matchedCount} matching tender opportunities for ${companyName}.
Top match score: ${input.topScore ?? 0}%
Sectors scanned: ${sectorsStr}
Next automated scan: ${nextRun} as per your scheduled cronjob.

First-draft Cover Letters & Technical Proposals are being compiled for you.
Review on your dashboard:
${dashboardUrl}

Quick Tenders Team
https://quicktenders.co.ke`

    if (resendConfigured() && emails.length > 0) {
      const emailRes = await sendEmail({
        to: emails,
        subject,
        html: emailHtml,
        text: emailText,
      })
      if (emailRes.ok) {
        result.emailSent = true
      } else {
        result.errors.push(`Email error: ${emailRes.error}`)
      }
    }

    if (textSmsConfigured() && phones.length > 0 && input.matchedCount > 0) {
      const smsText = `QuickTenders: Found ${input.matchedCount} tender match(es) for ${companyName}! Top match: ${input.topScore ?? 0}%. Review: ${dashboardUrl}`.slice(0, 160)
      const smsRes = await sendSms({
        to: phones,
        message: smsText,
      })
      if (smsRes.ok) {
        result.smsSent = true
      } else {
        result.errors.push(`SMS error: ${smsRes.error}`)
      }
    }

    return result
  }

  // --- CASE 2: NO MATCHES FOUND (0) ---
  // When no matches are found, DO NOT send email or SMS to prevent spamming clients.
  // The system logs this pass and checks again on the next cron cycle.
  return result
}

