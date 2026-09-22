/**
 * Custom admin email notifications for Quick Tenders.
 *
 * Used for sending custom announcements, updates, or messages to users/representatives.
 */

import { sendEmail } from './resend'

export type AdminEmailInput = {
  to: string[] | string
  subject: string
  html: string
  text?: string
}

export type AdminEmailResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string }

/**
 * Sends a custom email via Resend.
 * This is a thin wrapper around the resend sendEmail function with better typing
 * and error handling for admin use cases.
 */
export async function sendAdminEmail(input: AdminEmailInput): Promise<AdminEmailResult> {
  // Normalize to array
  const recipients = Array.isArray(input.to) ? input.to : [input.to]

  // Filter out empty emails
  const validRecipients = recipients
    .map((email) => email.trim())
    .filter((email) => email.length > 0)

  if (validRecipients.length === 0) {
    return { ok: false, error: 'No recipient addresses provided' }
  }

  try {
    const result = await sendEmail({
      to: validRecipients,
      subject: input.subject,
      html: input.html,
      text: input.text ?? '',
    })

    if (result.ok) {
      return { ok: true, id: result.id }
    } else {
      return { ok: false, error: result.error }
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error sending email',
    }
  }
}

/**
 * Builds a simple HTML email template for admin announcements.
 */
export function buildAdminAnnouncementEmail({
  title,
  body,
  companyName,
}: {
  title: string
  body: string
  companyName?: string
}): { subject: string; html: string; text: string } {
  const subject = companyName
    ? `[${companyName}] ${title}`
    : `[Quick Tenders] ${title}`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.6; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: #1d4ed8; color: #ffffff; padding: 24px; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
    .content { padding: 28px; }
    .footer { padding: 20px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
    .highlight { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📢 ${title}</h1>
    </div>
    <div class="content">
      ${companyName ? `<p style="margin-top: 0; font-size: 15px; color: #64748b;">Sent to: ${companyName}</p>` : ''}
      <div class="highlight">
        ${body.replace(/\n/g, '<br>')}
      </div>
    </div>
    <div class="footer">
      Quick Tenders Admin • <a href="https://quicktenders.co.ke" style="color: #1d4ed8; text-decoration: none;">quicktenders.co.ke</a>
    </div>
  </div>
</body>
</html>
  `.trim()

  const text = `
${title}
${companyName ? `Sent to: ${companyName}` : ''}

${body}

---
Quick Tenders Admin
https://quicktenders.co.ke
  `.trim()

  return { subject, html, text }
}