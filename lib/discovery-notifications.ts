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
      .map(
        (t) => `
        <div style="padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:12px;">
          <div style="font-weight:600;font-size:15px;color:#0f172a;margin-bottom:4px;">${escapeHtml(t.title)}</div>
          <div style="font-size:13px;color:#475569;margin-bottom:6px;">
            ${escapeHtml(t.procuringEntity || 'Procuring Entity')} &bull; Deadline: <strong>${escapeHtml(t.deadline || 'Open')}</strong>
          </div>
          <div style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:12px;font-weight:700;background:#dbeafe;color:#1e40af;">
            ${t.matchScore}% Compatibility
          </div>
        </div>
      `,
      )
      .join('')

    const emailHtml = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f8fafc;font-family:ui-sans-serif,system-ui,sans-serif;color:#0f172a;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    <tr><td style="padding:28px;">
      <div style="display:inline-block;padding:4px 10px;background:#eff6ff;color:#2563eb;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;border-radius:6px;margin-bottom:16px;">
        New Tender Matches
      </div>
      <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#0f172a;">Hello ${escapeHtml(primaryName)},</h2>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">
        Our automated discovery scan just identified <strong>${input.matchedCount} matching public tender opportunity${input.matchedCount === 1 ? '' : 'ies'}</strong> for <strong>${escapeHtml(companyName)}</strong> with a top match score of <strong>${input.topScore ?? 0}%</strong>.
      </p>

      <div style="margin:0 0 24px;">
        ${topTendersHtml}
      </div>

      <div style="padding:16px;background:#f1f5f9;border-radius:8px;margin-bottom:24px;font-size:13px;line-height:1.6;color:#475569;">
        <strong>Sectors scanned:</strong> ${escapeHtml(sectorsStr)}<br/>
        <strong>Next automated scan:</strong> <span style="color:#0f172a;font-weight:600;">${escapeHtml(nextRun)}</span> as per your scheduled cronjob.
      </div>

      <div style="text-align:center;margin-bottom:20px;">
        <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;">
          Review Tenders & Draft Proposals
        </a>
      </div>
    </td></tr>
  </table>
</body>
</html>`

    const emailText = `Hello ${primaryName},

Our automated discovery scan found ${input.matchedCount} matching tender opportunities for ${companyName}.
Top match score: ${input.topScore ?? 0}%
Sectors scanned: ${sectorsStr}
Next automated scan: ${nextRun} as per your scheduled cronjob.

Review on your dashboard:
${dashboardUrl}

Quick Tenders Team`

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

    if (textSmsConfigured() && phones.length > 0) {
      const smsText = `QuickTenders: Found ${input.matchedCount} tender match(es) for ${companyName}! Top score: ${input.topScore ?? 0}%. Next scan: ${nextRun}. Review: ${dashboardUrl}`.slice(0, 160)
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
  const subject = `Quick Tenders: Discovery Scan Complete (0 new matches for ${companyName})`

  const emailHtml = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f8fafc;font-family:ui-sans-serif,system-ui,sans-serif;color:#0f172a;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    <tr><td style="padding:28px;">
      <div style="display:inline-block;padding:4px 10px;background:#f1f5f9;color:#475569;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;border-radius:6px;margin-bottom:16px;">
        Automated Scan Summary
      </div>
      <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#0f172a;">Hello ${escapeHtml(primaryName)},</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
        Our automated discovery scan just checked procurement portals across Kenya (GAA, TendersInfo, Tenders Kenya, etc.) for <strong>${escapeHtml(companyName)}</strong>.
      </p>

      <div style="padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:24px;font-size:14px;line-height:1.7;color:#475569;">
        <div>&bull; <strong>Tenders scanned:</strong> ${input.tendersScanned}</div>
        <div>&bull; <strong>Sectors analyzed:</strong> ${escapeHtml(sectorsStr)}</div>
        <div>&bull; <strong>Status:</strong> 0 new tenders exceeded your compatibility threshold in this pass.</div>
        <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #cbd5e1;color:#0f172a;font-weight:600;">
          &bull; Next scheduled automated scan: ${escapeHtml(nextRun)}
        </div>
      </div>

      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#64748b;">
        You can trigger an on-demand scan or customize target sectors at any time from your dashboard.
      </p>

      <div style="text-align:center;margin-bottom:20px;">
        <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;">
          Open Dashboard
        </a>
      </div>
    </td></tr>
  </table>
</body>
</html>`

  const emailText = `Hello ${primaryName},

Automated AI tender scan complete for ${companyName}.
Tenders scanned: ${input.tendersScanned}
Sectors analyzed: ${sectorsStr}
Status: 0 new tenders met the threshold in this scan.
Next scheduled scan: ${nextRun} as per your scheduled cronjob.

Access your dashboard anytime:
${dashboardUrl}

Quick Tenders Team`

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

  if (textSmsConfigured() && phones.length > 0) {
    const smsText = `QuickTenders: 0 new matches in latest scan for ${companyName}. Next automated scan: ${nextRun}. Dashboard: ${dashboardUrl}`.slice(0, 160)
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
