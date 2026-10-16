import { getSiteUrl } from '@/lib/env'

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const VERIFY_TIMEOUT_MS = 10_000

export type TurnstileAction = 'google_auth'

export function turnstileSiteKey(): string | null {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null
}

export function turnstileTokenRequired(): boolean {
  return process.env.NODE_ENV === 'production' || turnstileSiteKey() !== null
}

export function turnstileMissingTokenMessage(): string | null {
  return turnstileTokenRequired()
    ? 'Complete the security check before continuing.'
    : null
}

export function isValidTurnstileResponse(
  payload: unknown,
  expectedHostname: string,
  expectedAction: TurnstileAction,
): boolean {
  if (!payload || typeof payload !== 'object') return false

  const result = payload as { success?: unknown; hostname?: unknown; action?: unknown }

  return (
    result.success === true &&
    result.hostname === expectedHostname &&
    result.action === expectedAction
  )
}

export async function verifyTurnstile(
  token: string | null | undefined,
  action: TurnstileAction,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim()

  if (!secret) {
    if (process.env.NODE_ENV !== 'production' && !turnstileSiteKey()) {
      return { ok: true }
    }

    console.error('[turnstile] TURNSTILE_SECRET_KEY is not configured')
    return { ok: false, message: 'Security verification is temporarily unavailable.' }
  }

  const trimmedToken = token?.trim()
  if (!trimmedToken || trimmedToken.length > 2048) {
    return { ok: false, message: 'Complete the security check before continuing.' }
  }

  let expectedHostname: string
  try {
    expectedHostname = new URL(
      process.env.TURNSTILE_SITE_URL?.trim() || getSiteUrl(),
    ).hostname
  } catch {
    console.error('[turnstile] TURNSTILE_SITE_URL is invalid')
    return { ok: false, message: 'Security verification is temporarily unavailable.' }
  }

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        secret,
        response: trimmedToken,
        idempotency_key: crypto.randomUUID(),
      }),
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    })

    if (!response.ok) {
      console.error(`[turnstile] Siteverify returned HTTP ${response.status}`)
      return { ok: false, message: 'Security verification failed. Please try again.' }
    }

    const payload: unknown = await response.json()
    if (!isValidTurnstileResponse(payload, expectedHostname, action)) {
      console.warn('[turnstile] Rejected token: unsuccessful, wrong hostname, or wrong action')
      return { ok: false, message: 'Security verification failed. Please try again.' }
    }

    return { ok: true }
  } catch (error) {
    console.error(
      '[turnstile] Siteverify request failed:',
      error instanceof Error ? error.message : String(error),
    )
    return { ok: false, message: 'Security verification is temporarily unavailable.' }
  }
}
