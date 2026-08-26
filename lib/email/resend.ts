/**
 * Resend client.
 *
 * A single POST to one documented endpoint, so this uses fetch rather than the
 * SDK. One less dependency to install, audit and keep current, and nothing here
 * needs streaming, attachments or batching yet.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const TIMEOUT_MS = 15_000

export type SendEmailInput = {
  to: string[]
  subject: string
  html: string
  text: string
  replyTo?: string
}

export type SendEmailResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string }

export function resendConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim(),
  )
}

export function resendConfigHint(): string {
  const missing: string[] = []

  if (!process.env.RESEND_API_KEY?.trim()) missing.push('RESEND_API_KEY')
  if (!process.env.RESEND_FROM_EMAIL?.trim()) missing.push('RESEND_FROM_EMAIL')

  return missing.length > 0
    ? `Email is not configured: ${missing.join(' and ')} not set`
    : 'Email is configured'
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.RESEND_FROM_EMAIL?.trim()

  if (!apiKey || !from) {
    return { ok: false, error: resendConfigHint() }
  }

  const recipients = input.to.map((address) => address.trim()).filter(Boolean)

  if (recipients.length === 0) {
    return { ok: false, error: 'No recipient addresses' }
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    const payload: unknown = await response.json().catch(() => null)

    if (!response.ok) {
      const message =
        payload && typeof payload === 'object' && 'message' in payload
          ? String((payload as { message: unknown }).message)
          : `HTTP ${response.status}`

      return { ok: false, error: `Resend rejected the message: ${message}` }
    }

    const id =
      payload && typeof payload === 'object' && 'id' in payload
        ? String((payload as { id: unknown }).id)
        : null

    return { ok: true, id }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
