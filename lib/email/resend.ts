/**
 * Resend client.
 *
 * A single POST to one documented endpoint, so this uses fetch rather than the
 * SDK. One less dependency to install, audit and keep current, and nothing here
 * needs streaming, attachments or batching yet.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const TIMEOUT_MS = 15_000

/**
 * Resend's shared sender, which works with no DNS setup but only delivers to the
 * address that owns the Resend account. Used as a development fallback when the
 * configured sender's domain is not verified — see sendEmail below.
 */
export const RESEND_TEST_SENDER = 'Quick Tenders (dev) <onboarding@resend.dev>'

/** Domains Resend can never verify, because nobody signing up owns them. */
const UNVERIFIABLE_SENDER_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
])

export type SendEmailInput = {
  to: string[]
  subject: string
  html: string
  text: string
  replyTo?: string
}

export type SendEmailResult =
  | { ok: true; id: string | null; from: string; usedFallbackSender: boolean }
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

/** The domain part of a "Name <local@domain>" or bare "local@domain" sender. */
export function senderDomain(from: string): string | null {
  const angle = from.match(/<([^>]+)>/)
  const address = (angle ? angle[1] : from).trim()
  const domain = address.split('@')[1]?.trim().toLowerCase()

  return domain || null
}

/**
 * True when RESEND_FROM_EMAIL can never be made to work.
 *
 * Resend requires the sending domain to be verified by DNS, which is impossible
 * for a consumer mailbox: quicktenders.ke@gmail.com is rejected on every send
 * with "The gmail.com domain is not verified", and no amount of configuration
 * changes that. Worth detecting explicitly, because the error reads like a
 * missing setup step rather than an impossible one.
 */
export function senderIsUnverifiable(from: string): boolean {
  const domain = senderDomain(from)

  return domain !== null && UNVERIFIABLE_SENDER_DOMAINS.has(domain)
}

/**
 * Whether to silently fall back to the Resend test sender.
 *
 * Only outside production, and only when the configured sender is one that can
 * never be verified. In production a broken sender must fail loudly rather than
 * quietly sending from resend.dev, which would reach nobody but the account
 * owner and look like success.
 */
function shouldFallBack(from: string): boolean {
  if (process.env.NODE_ENV === 'production') return false
  if (process.env.RESEND_ALLOW_TEST_SENDER?.trim() === 'false') return false

  return senderIsUnverifiable(from)
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const configuredFrom = process.env.RESEND_FROM_EMAIL?.trim()

  if (!apiKey || !configuredFrom) {
    return { ok: false, error: resendConfigHint() }
  }

  const usedFallbackSender = shouldFallBack(configuredFrom)
  const from = usedFallbackSender ? RESEND_TEST_SENDER : configuredFrom

  if (usedFallbackSender) {
    console.warn(
      `[resend] RESEND_FROM_EMAIL is ${configuredFrom}, whose domain ` +
        `(${senderDomain(configuredFrom)}) can never be verified with Resend. ` +
        `Falling back to ${RESEND_TEST_SENDER}, which only delivers to the address ` +
        'that owns the Resend account. Verify a domain you control and set ' +
        'RESEND_FROM_EMAIL to an address on it before going live.',
    )
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

      return {
        ok: false,
        error: `Resend rejected the message (from ${from}): ${message}`,
      }
    }

    const id =
      payload && typeof payload === 'object' && 'id' in payload
        ? String((payload as { id: unknown }).id)
        : null

    return { ok: true, id, from, usedFallbackSender }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
