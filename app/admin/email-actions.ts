'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { sendAdminEmail, type AdminEmailInput } from '@/lib/email/admin-custom'

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
 * - companyId: when recipientType is 'company'
 * - representativeIds: when recipientType is 'selected' (comma-separated string)
 */
export async function sendCustomEmailAction(
  _prevState: SendCustomEmailState,
  formData: FormData,
): Promise<SendCustomEmailState> {
  const subject = String(formData.get('subject') ?? '').trim()
  const body = String(formData.get('body') ?? '').trim()
  const recipientType = String(formData.get('recipientType') ?? 'all')
  const companyId = String(formData.get('companyId') ?? '')
  const representativeIdsStr = String(formData.get('representativeIds') ?? '')

  // Basic validation
  if (!subject) {
    return { ok: false, message: 'Subject is required' }
  }
  if (!body) {
    return { ok: false, message: 'Email body is required' }
  }

  try {
    const { supabase } = await assertAdmin()

    let recipientEmails: string[] = []

    // Get recipients based on type
    if (recipientType === 'all') {
      // Get all representatives
      const { data, error } = await supabase
        .from('representatives')
        .select('email')
        .order('created_at')

      if (error) throw error
      recipientEmails = data.map((rep) => rep.email).filter(Boolean)
    } else if (recipientType === 'company') {
      if (!companyId) {
        return { ok: false, message: 'Company ID is required' }
      }
      // Get representatives for specific company
      const { data, error } = await supabase
        .from('representatives')
        .select('email')
        .eq('company_id', companyId)
        .order('created_at')

      if (error) throw error
      recipientEmails = data.map((rep) => rep.email).filter(Boolean)
    } else if (recipientType === 'selected') {
      if (!representativeIdsStr) {
        return { ok: false, message: 'No representatives selected' }
      }
      // Get representatives by IDs
      const ids = representativeIdsStr
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0)

      if (ids.length === 0) {
        return { ok: false, message: 'No valid representative IDs provided' }
      }

      const { data, error } = await supabase
        .from('representatives')
        .select('email')
        .in('id', ids)

      if (error) throw error
      recipientEmails = data.map((rep) => rep.email).filter(Boolean)
    } else {
      return { ok: false, message: 'Invalid recipient type' }
    }

    if (recipientEmails.length === 0) {
      return { ok: false, message: 'No recipients found' }
    }

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
 * - companyId: when recipientType is 'company'
 * - representativeIds: when recipientType is 'selected' (comma-separated string)
 * - isImportant: whether to mark as important (optional)
 */
export async function sendUpdateAction(
  _prevState: SendUpdateState,
  formData: FormData,
): Promise<SendUpdateState> {
  const title = String(formData.get('title') ?? '').trim()
  const content = String(formData.get('content') ?? '').trim()
  const recipientType = String(formData.get('recipientType') ?? 'all')
  const companyId = String(formData.get('companyId') ?? '')
  const representativeIdsStr = String(formData.get('representativeIds') ?? '')
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

    let recipientEmails: string[] = []

    // Get recipients based on type (same logic as sendCustomEmailAction)
    if (recipientType === 'all') {
      // Get all representatives
      const { data, error } = await supabase
        .from('representatives')
        .select('email')
        .order('created_at')

      if (error) throw error
      recipientEmails = data.map((rep) => rep.email).filter(Boolean)
    } else if (recipientType === 'company') {
      if (!companyId) {
        return { ok: false, message: 'Company ID is required' }
      }
      // Get representatives for specific company
      const { data, error } = await supabase
        .from('representatives')
        .select('email')
        .eq('company_id', companyId)
        .order('created_at')

      if (error) throw error
      recipientEmails = data.map((rep) => rep.email).filter(Boolean)
    } else if (recipientType === 'selected') {
      if (!representativeIdsStr) {
        return { ok: false, message: 'No representatives selected' }
      }
      // Get representatives by IDs
      const ids = representativeIdsStr
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0)

      if (ids.length === 0) {
        return { ok: false, message: 'No valid representative IDs provided' }
      }

      const { data, error } = await supabase
        .from('representatives')
        .select('email')
        .in('id', ids)

      if (error) throw error
      recipientEmails = data.map((rep) => rep.email).filter(Boolean)
    } else {
      return { ok: false, message: 'Invalid recipient type' }
    }

    if (recipientEmails.length === 0) {
      return { ok: false, message: 'No recipients found' }
    }

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

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function buildAdminEmailContent(
  subject: string,
  body: string,
): { html: string; text: string } {
  // Simple HTML email template
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.6; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 20px; }
    .content { line-height: 1.6; }
    .footer { margin-top: 30px; font-size: 14px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${subject}</h2>
    </div>
    <div class="content">
      ${body.replace(/\n/g, '<br>')}
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