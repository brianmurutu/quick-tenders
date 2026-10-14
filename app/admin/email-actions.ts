'use server'

import { createClient } from '@/lib/supabase/server'
import { sendAdminEmail, buildAdminAnnouncementEmail } from '@/lib/email/admin-custom'
import { normaliseKenyanPhone, sendSms } from '@/lib/sms/textsms'
import type { Database } from '@/types/database'

// ---------------------------------------------------------------------------
// Guard helper
// ---------------------------------------------------------------------------

/**
 * Verifies the calling session is an admin.
 *
 * This is a belt-and-suspenders check: the RPC functions themselves call
 * is_admin() and raise a Postgres exception if the caller is not an admin, so
 * even if this guard were bypassed somehow the database would still refuse.
 *
 * Throws if the user is not signed in or not in admin_users.
 */
async function assertAdmin() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (!adminRow) throw new Error('Not an admin')

  return { supabase, user }
}

type AdminClient = ReturnType<typeof createClient>
type CommunicationRecipient = Pick<
  Database['public']['Tables']['representatives']['Row'],
  'id' | 'company_id' | 'full_name' | 'email' | 'phone_number'
>

async function resolveRecipients(
  supabase: AdminClient,
  recipientType: string,
  formData: FormData,
): Promise<
  | { ok: true; recipients: CommunicationRecipient[] }
  | { ok: false; message: string }
> {
  let query = supabase
    .from('representatives')
    .select('id, company_id, full_name, email, phone_number')
    .order('created_at')

  if (recipientType === 'company') {
    const companyId = String(formData.get('companyId') ?? '').trim()
    if (!companyId) return { ok: false, message: 'Choose a company' }
    query = query.eq('company_id', companyId)
  } else if (recipientType === 'selected') {
    const representativeIds = Array.from(
      new Set(
        formData
          .getAll('representativeIds')
          .map(String)
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    )
    if (representativeIds.length === 0) {
      return { ok: false, message: 'Choose at least one representative' }
    }
    query = query.in('id', representativeIds)
  } else if (recipientType !== 'all') {
    return { ok: false, message: 'Choose a valid recipient group' }
  }

  const { data, error } = await query
  if (error) throw error
  if (!data?.length) return { ok: false, message: 'No recipients found' }

  return { ok: true, recipients: data }
}

// ---------------------------------------------------------------------------
// Send custom email to representatives
// ---------------------------------------------------------------------------

export type SendCustomEmailState = {
  ok: boolean
  message: string
  sentCount?: number
}

/**
 * Server Action: send a custom email to specified representatives.
 *
 * Expected formData fields:
 * - subject: email subject
 * - body: email body (plain text, will be converted to HTML)
 * - recipientType: 'all' | 'company' | 'selected'
 * - companyId: selected company UUID when recipientType is 'company'
 * - representativeIds: repeated checkbox values when recipientType is 'selected'
 */
export async function sendCustomEmailAction(
  _prevState: SendCustomEmailState | undefined,
  formData: FormData,
): Promise<SendCustomEmailState> {
  const subject = String(formData.get('subject') ?? '').trim()
  const body = String(formData.get('body') ?? '').trim()
  const recipientType = String(formData.get('recipientType') ?? 'all')

  // Basic validation
  if (!subject) {
    return { ok: false, message: 'Subject is required' }
  }
  if (!body) {
    return { ok: false, message: 'Email body is required' }
  }

  try {
    const { supabase } = await assertAdmin()

    const target = await resolveRecipients(supabase, recipientType, formData)
    if (!target.ok) return target
    const recipientEmails = target.recipients.map((rep) => rep.email)

    // Build email content
    const { html, text } = buildAdminEmailContent(subject, body)

    // Send email
    const emailResult = await sendAdminEmail({
      to: recipientEmails,
      subject,
      html,
      text,
    })

    if (emailResult.ok) {
      return {
        ok: true,
        message: `Email sent successfully to ${recipientEmails.length} recipient${recipientEmails.length === 1 ? '' : 's'}.`,
        sentCount: recipientEmails.length,
      }
    } else {
      return { ok: false, message: `Failed to send email: ${emailResult.error}` }
    }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'An unexpected error occurred',
    }
  }
}

// ---------------------------------------------------------------------------
// Send update/newsletter
// ---------------------------------------------------------------------------

export type SendUpdateState = {
  ok: boolean
  message: string
  sentCount?: number
}

/**
 * Server Action: send an update/newsletter to representatives.
 *
 * Expected formData fields:
 * - title: update title
 * - content: update content (plain text)
 * - recipientType: 'all' | 'company' | 'selected'
 * - companyId: selected company UUID when recipientType is 'company'
 * - representativeIds: repeated checkbox values when recipientType is 'selected'
 * - isImportant: whether to mark as important (optional)
 */
export async function sendUpdateAction(
  _prevState: SendUpdateState | undefined,
  formData: FormData,
): Promise<SendUpdateState> {
  const title = String(formData.get('title') ?? '').trim()
  const content = String(formData.get('content') ?? '').trim()
  const recipientType = String(formData.get('recipientType') ?? 'all')
  const isImportant = formData.get('isImportant') === 'on'

  // Basic validation
  if (!title) {
    return { ok: false, message: 'Title is required' }
  }
  if (!content) {
    return { ok: false, message: 'Update content is required' }
  }

  try {
    const { supabase } = await assertAdmin()

    const target = await resolveRecipients(supabase, recipientType, formData)
    if (!target.ok) return target
    const recipientEmails = target.recipients.map((rep) => rep.email)

    // Build email content using the announcement template
    const { subject, html, text } = buildAdminAnnouncementEmail({
      title: isImportant ? `[IMPORTANT] ${title}` : title,
      body: content,
      companyName: undefined, // We'll add company-specific info if needed
    })

    // Send email
    const emailResult = await sendAdminEmail({
      to: recipientEmails,
      subject,
      html,
      text,
    })

    if (emailResult.ok) {
      return {
        ok: true,
        message: `Update sent successfully to ${recipientEmails.length} recipient${recipientEmails.length === 1 ? '' : 's'}.`,
        sentCount: recipientEmails.length,
      }
    } else {
      return { ok: false, message: `Failed to send update: ${emailResult.error}` }
    }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'An unexpected error occurred',
    }
  }
}

export type SendSmsBlastState = {
  ok: boolean
  message: string
  sentCount?: number
}

export async function sendSmsBlastAction(
  _prevState: SendSmsBlastState | undefined,
  formData: FormData,
): Promise<SendSmsBlastState> {
  const message = String(formData.get('message') ?? '').trim()
  const recipientType = String(formData.get('recipientType') ?? '')

  if (!message) return { ok: false, message: 'SMS message is required' }
  if (message.length > 160) {
    return { ok: false, message: 'Keep the SMS to 160 characters or fewer' }
  }
  if (formData.get('confirmSend') !== 'on') {
    return { ok: false, message: 'Confirm the recipients before sending' }
  }

  try {
    const { supabase } = await assertAdmin()
    const target = await resolveRecipients(supabase, recipientType, formData)
    if (!target.ok) return target

    const phoneNumbers = Array.from(new Set(target.recipients
      .map((rep) => rep.phone_number)
      .filter((phone): phone is string => phone !== null)
      .filter((phone) => normaliseKenyanPhone(phone) !== null)))

    if (phoneNumbers.length === 0) {
      return { ok: false, message: 'No selected representatives have a valid Kenyan phone number' }
    }

    const result = await sendSms({ to: phoneNumbers, message })
    if (!result.ok) return { ok: false, message: `SMS was not sent: ${result.error}` }

    return {
      ok: true,
      sentCount: phoneNumbers.length,
      message: `SMS sent to ${phoneNumbers.length} representative${phoneNumbers.length === 1 ? '' : 's'}.`,
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
    }
  }
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[character] ?? character
  })
}

function buildAdminEmailContent(
  subject: string,
  body: string,
): { html: string; text: string } {
  const safeSubject = escapeHtml(subject)
  const safeBody = body
    .split(/\r?\n/)
    .map(escapeHtml)
    .join('<br>')

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; color: #15221b; line-height: 1.6; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 20px; }
    .content { line-height: 1.6; }
    .footer { margin-top: 30px; font-size: 14px; color: #4a5a50; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${safeSubject}</h2>
    </div>
    <div class="content">
      ${safeBody}
    </div>
    <div class="footer">
      Quick Tenders Admin<br>
      <a href="https://quicktenders.co.ke">quicktenders.co.ke</a>
    </div>
  </div>
</body>
</html>
  `.trim()

  const text = `
${subject}

${body}

--
Quick Tenders Admin
https://quicktenders.co.ke
  `.trim()

  return { html, text }
}