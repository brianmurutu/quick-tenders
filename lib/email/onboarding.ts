import { getSiteUrl } from '@/lib/env'
import { sendEmail, type SendEmailResult } from './resend'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function sendOnboardingEmail(input: {
  email: string
  fullName: string
  companyName: string
}): Promise<SendEmailResult> {
  const siteUrl = getSiteUrl()
  const name = escapeHtml(input.fullName)
  const company = escapeHtml(input.companyName)
  const subject = 'Welcome to Quick Tenders — finish your company profile'

  return sendEmail({
    to: [input.email],
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6;max-width:600px;margin:auto">
        <h1 style="color:#1d4ed8">Welcome to Quick Tenders</h1>
        <p>Hello ${name},</p>
        <p>Your email is confirmed and ${company} is registered. Complete your company profile so we can match relevant public tenders to your business.</p>
        <p><a href="${siteUrl}/onboarding" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none">Complete your profile</a></p>
        <p>Your profile helps us filter opportunities by your sector, county and company size. You can update these details later.</p>
        <p>— The Quick Tenders team</p>
      </div>
    `.trim(),
    text:
      `Hello ${input.fullName},\n\n` +
      `Your email is confirmed and ${input.companyName} is registered. Complete your company profile so we can match relevant public tenders to your business:\n\n` +
      `${siteUrl}/onboarding\n\n` +
      'Your profile helps us filter opportunities by your sector, county and company size. You can update these details later.\n\n' +
      '— The Quick Tenders team',
  })
}
