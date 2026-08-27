/**
 * TextSMS.co.ke client.
 *
 * A single POST to the TextSMS REST API. Uses fetch — no SDK — mirroring the
 * pattern established by the Resend client in lib/email/resend.ts.
 *
 * API docs: https://www.textsms.co.ke/api-documentation
 */

const TEXTSMS_ENDPOINT = 'https://api.textsms.co.ke/api/services/sendsms/'
const TIMEOUT_MS = 15_000

export type SendSmsInput = {
  /** Destination number(s). E.164 or Kenyan local format (e.g. 07xx or +2547xx). */
  to: string | string[]
  /** SMS message body — keep ≤ 160 chars for a single part. */
  message: string
}

export type SendSmsResult =
  | { ok: true; messageId: string | null }
  | { ok: false; error: string }

export function textSmsConfigured(): boolean {
  return Boolean(
    process.env.TEXTSMS_API_KEY?.trim() && process.env.TEXTSMS_SENDER_ID?.trim(),
  )
}

export function textSmsConfigHint(): string {
  const missing: string[] = []
  if (!process.env.TEXTSMS_API_KEY?.trim()) missing.push('TEXTSMS_API_KEY')
  if (!process.env.TEXTSMS_SENDER_ID?.trim()) missing.push('TEXTSMS_SENDER_ID')
  return missing.length > 0
    ? `SMS is not configured: ${missing.join(' and ')} not set`
    : 'SMS is configured'
}

/**
 * Normalise a phone number to the format TextSMS expects (254XXXXXXXXX).
 * Accepts +254..., 254..., 07..., 01... formats.
 */
export function normaliseKenyanPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')

  // Already 254XXXXXXXXX
  if (/^254[17]\d{8}$/.test(digits)) return digits

  // +2547XXXXXXXX or 2547XXXXXXXX
  if (/^2547\d{8}$/.test(digits)) return digits
  if (/^2541\d{8}$/.test(digits)) return digits

  // 07XXXXXXXX → 2547XXXXXXXX
  if (/^07\d{8}$/.test(digits)) return `254${digits.slice(1)}`

  // 01XXXXXXXX → 2541XXXXXXXX  (Airtel short codes)
  if (/^01\d{8}$/.test(digits)) return `254${digits.slice(1)}`

  // 7XXXXXXXXX (10 digits starting with 7)
  if (/^7\d{8}$/.test(digits)) return `254${digits}`

  return null
}

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const apiKey = process.env.TEXTSMS_API_KEY?.trim()
  const partnerID = process.env.TEXTSMS_PARTNER_ID?.trim() ?? '1'
  const senderId = process.env.TEXTSMS_SENDER_ID?.trim()

  if (!apiKey || !senderId) {
    return { ok: false, error: textSmsConfigHint() }
  }

  const numbers = Array.isArray(input.to) ? input.to : [input.to]
  const normalised = numbers
    .map(normaliseKenyanPhone)
    .filter((n): n is string => n !== null)

  if (normalised.length === 0) {
    return { ok: false, error: 'No valid Kenyan phone numbers provided' }
  }

  try {
    const response = await fetch(TEXTSMS_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        apikey: apiKey,
        partnerID,
        message: input.message,
        shortcode: senderId,
        mobile: normalised.join(','),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    const payload: unknown = await response.json().catch(() => null)

    if (!response.ok) {
      const message =
        payload && typeof payload === 'object' && 'error' in payload
          ? String((payload as { error: unknown }).error)
          : `HTTP ${response.status}`
      return { ok: false, error: `TextSMS rejected the request: ${message}` }
    }

    // TextSMS returns { "responses": [{ "messageid": "...", "response-code": 200 }] }
    const messageId =
      payload &&
      typeof payload === 'object' &&
      'responses' in payload &&
      Array.isArray((payload as { responses: unknown[] }).responses) &&
      (payload as { responses: { messageid?: unknown }[] }).responses[0]?.messageid
        ? String((payload as { responses: { messageid: unknown }[] }).responses[0].messageid)
        : null

    return { ok: true, messageId }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
