/**
 * Admin email notification service for Quick Tenders.
 *
 * Sends notifications for:
 * 1. New user / company registrations.
 * 2. Successful payments & subscriptions.
 *
 * Primary recipient: quicktenders.ke@gmail.com (configurable via ADMIN_NOTIFICATION_EMAIL).
 */

import { sendEmail } from './resend'

export const DEFAULT_ADMIN_EMAIL = 'quicktenders.ke@gmail.com'

export function adminNotificationEmail(): string {
  return process.env.ADMIN_NOTIFICATION_EMAIL?.trim() || DEFAULT_ADMIN_EMAIL
}

export type NewSignupNotificationInput = {
  fullName: string
  email: string
  companyName: string
  domain?: string
  industry?: string
  sectors?: string[]
}

export type PaymentNotificationInput = {
  email: string
  companyName?: string | null
  amountKes: number
  planName?: string
  reference: string
  paymentMethod?: string
}

function formatDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'full',
    timeStyle: 'medium',
    timeZone: 'Africa/Nairobi',
  }).format(date)
}

function formatKes(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
  }).format(amount)
}

/**
 * Notifies the admin when a new user/company registers on Quick Tenders.
 */
export async function notifyAdminOfSignup(input: NewSignupNotificationInput): Promise<void> {
  const adminEmail = adminNotificationEmail()
  const timestamp = formatDate()

  const subject = `🎉 New Signup: ${input.fullName} (${input.companyName})`

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
    .card { background: #f1f5f9; border-radius: 8px; padding: 18px; margin: 18px 0; border: 1px solid #cbd5e1; }
    .row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
    .row:last-child { margin-bottom: 0; }
    .label { font-weight: 600; color: #475569; }
    .value { color: #0f172a; font-weight: 500; text-align: right; }
    .badge { display: inline-block; background: #dbeafe; color: #1e40af; font-size: 12px; font-weight: 600; padding: 3px 8px; border-radius: 4px; }
    .footer { padding: 20px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚀 New User & Company Registration</h1>
    </div>
    <div class="content">
      <p style="margin-top: 0; font-size: 15px;">A new company representative has just signed up on Quick Tenders:</p>
      
      <div class="card">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #475569; font-weight: 600; font-size: 14px;">Full Name:</td>
            <td style="padding: 6px 0; color: #0f172a; font-weight: 600; font-size: 14px; text-align: right;">${input.fullName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #475569; font-weight: 600; font-size: 14px;">Company Name:</td>
            <td style="padding: 6px 0; color: #0f172a; font-weight: 600; font-size: 14px; text-align: right;">${input.companyName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #475569; font-weight: 600; font-size: 14px;">Email Address:</td>
            <td style="padding: 6px 0; color: #1d4ed8; font-weight: 600; font-size: 14px; text-align: right;">${input.email}</td>
          </tr>
          ${input.domain ? `
          <tr>
            <td style="padding: 6px 0; color: #475569; font-weight: 600; font-size: 14px;">Company Domain:</td>
            <td style="padding: 6px 0; color: #0f172a; font-size: 14px; text-align: right;">${input.domain}</td>
          </tr>` : ''}
          ${input.industry ? `
          <tr>
            <td style="padding: 6px 0; color: #475569; font-weight: 600; font-size: 14px;">Industry:</td>
            <td style="padding: 6px 0; color: #0f172a; font-size: 14px; text-align: right;">${input.industry}</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 6px 0; color: #475569; font-weight: 600; font-size: 14px;">Signup Time:</td>
            <td style="padding: 6px 0; color: #64748b; font-size: 13px; text-align: right;">${timestamp}</td>
          </tr>
        </table>
      </div>

      <p style="font-size: 13px; color: #475569;">
        The user's 3-day free trial has been activated. They can now access tender discovery and AI bid drafting.
      </p>
    </div>
    <div class="footer">
      Quick Tenders Admin Alert • <a href="https://quicktenders.co.ke" style="color: #1d4ed8; text-decoration: none;">quicktenders.co.ke</a>
    </div>
  </div>
</body>
</html>
  `.trim()

  const text = `
New User & Company Registration

Full Name: ${input.fullName}
Company: ${input.companyName}
Email: ${input.email}
Domain: ${input.domain ?? 'N/A'}
Industry: ${input.industry ?? 'N/A'}
Signup Time: ${timestamp}
  `.trim()

  try {
    await sendEmail({
      to: [adminEmail],
      subject,
      html,
      text,
    })
  } catch (error) {
    console.error('[admin-notification] Failed to send signup notification email:', error)
  }
}

/**
 * Notifies the admin when a payment / subscription is completed.
 */
export async function notifyAdminOfPayment(input: PaymentNotificationInput): Promise<void> {
  const adminEmail = adminNotificationEmail()
  const timestamp = formatDate()
  const formattedAmount = formatKes(input.amountKes)

  const subject = `💰 Payment Received: ${formattedAmount} from ${input.companyName || input.email}`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.6; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: #059669; color: #ffffff; padding: 24px; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
    .content { padding: 28px; }
    .card { background: #f0fdf4; border-radius: 8px; padding: 18px; margin: 18px 0; border: 1px solid #bbf7d0; }
    .footer { padding: 20px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💰 Payment & Subscription Received</h1>
    </div>
    <div class="content">
      <p style="margin-top: 0; font-size: 15px;">A payment has been successfully completed and processed on Paystack:</p>
      
      <div class="card">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #166534; font-weight: 600; font-size: 15px;">Amount Paid:</td>
            <td style="padding: 6px 0; color: #166534; font-weight: 700; font-size: 18px; text-align: right;">${formattedAmount}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #475569; font-weight: 600; font-size: 14px;">Plan:</td>
            <td style="padding: 6px 0; color: #0f172a; font-weight: 600; font-size: 14px; text-align: right;">${input.planName ?? 'Quick Tenders Paid Plan'}</td>
          </tr>
          ${input.companyName ? `
          <tr>
            <td style="padding: 6px 0; color: #475569; font-weight: 600; font-size: 14px;">Company Name:</td>
            <td style="padding: 6px 0; color: #0f172a; font-weight: 600; font-size: 14px; text-align: right;">${input.companyName}</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 6px 0; color: #475569; font-weight: 600; font-size: 14px;">Customer Email:</td>
            <td style="padding: 6px 0; color: #1d4ed8; font-weight: 600; font-size: 14px; text-align: right;">${input.email}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #475569; font-weight: 600; font-size: 14px;">Paystack Reference:</td>
            <td style="padding: 6px 0; color: #0f172a; font-family: monospace; font-size: 13px; text-align: right;">${input.reference}</td>
          </tr>
          ${input.paymentMethod ? `
          <tr>
            <td style="padding: 6px 0; color: #475569; font-weight: 600; font-size: 14px;">Payment Method:</td>
            <td style="padding: 6px 0; color: #0f172a; font-size: 14px; text-align: right;">${input.paymentMethod}</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 6px 0; color: #475569; font-weight: 600; font-size: 14px;">Time:</td>
            <td style="padding: 6px 0; color: #64748b; font-size: 13px; text-align: right;">${timestamp}</td>
          </tr>
        </table>
      </div>

      <p style="font-size: 13px; color: #475569;">
        The company plan status has been updated to <strong>paid</strong> in the database.
      </p>
    </div>
    <div class="footer">
      Quick Tenders Billing Alert • <a href="https://quicktenders.co.ke" style="color: #059669; text-decoration: none;">quicktenders.co.ke</a>
    </div>
  </div>
</body>
</html>
  `.trim()

  const text = `
Payment Received: ${formattedAmount}

Plan: ${input.planName ?? 'Quick Tenders Paid Plan'}
Company: ${input.companyName ?? 'N/A'}
Email: ${input.email}
Reference: ${input.reference}
Time: ${timestamp}
  `.trim()

  try {
    await sendEmail({
      to: [adminEmail],
      subject,
      html,
      text,
    })
  } catch (error) {
    console.error('[admin-notification] Failed to send payment notification email:', error)
  }
}
