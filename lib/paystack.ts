/**
 * Paystack payment integration.
 *
 * Uses plain fetch — no SDK — exactly as the Resend client does. All amounts
 * are displayed in KES, but Paystack accepts amounts in the minor currency
 * unit. KES uses cents, so requests multiply the displayed price by 100.
 *
 * Docs: https://paystack.com/docs/api/
 */

const PAYSTACK_BASE = 'https://api.paystack.co'
const TIMEOUT_MS = 20_000

// ---------------------------------------------------------------------------
// Configuration helpers
// ---------------------------------------------------------------------------

export type SubscriptionPlanId = 'starter' | 'pro'

export type SubscriptionPlan = {
  id: SubscriptionPlanId
  name: string
  amountKes: number
  interval: string
  badge?: string
  description: string
  features: string[]
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'starter',
    name: 'Quick Tenders Starter (Demo)',
    amountKes: 1,
    interval: 'month',
    badge: 'Presentation / Test',
    description: 'Perfect for testing and live demonstration.',
    features: [
      'Continuous tender monitoring across all sources',
      'AI-scored matches against your company profile',
      'Standard bid document drafts',
      'Email notifications for new matches',
      'Cancel any time',
    ],
  },
  {
    id: 'pro',
    name: 'Quick Tenders Pro',
    amountKes: 2000,
    interval: 'month',
    badge: 'Recommended',
    description: 'Full automated tender intelligence & drafting suite.',
    features: [
      'Continuous tender monitoring across all sources',
      'AI-scored matches against your company profile',
      'Full bid document drafts per match',
      'Email + SMS notifications for new matches',
      'Priority matching & drafting updates',
      'Cancel any time',
    ],
  },
]

export function getSubscriptionPlan(planId?: string | null): SubscriptionPlan {
  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planId)
  return plan ?? SUBSCRIPTION_PLANS[0]
}

export function isValidPlanAmountKes(amountKes: number): boolean {
  return SUBSCRIPTION_PLANS.some((p) => p.amountKes === amountKes)
}

export function isValidPlanAmountMinor(amountMinor: number): boolean {
  return SUBSCRIPTION_PLANS.some((p) => p.amountKes * 100 === amountMinor)
}

export function paystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY?.trim())
}

export function paystackPublicKey(): string {
  return process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY?.trim() ?? ''
}

/** Default monthly plan amount in KES (defaults to 2000 if not set). */
export function paystackPlanAmountKes(): number {
  const raw = process.env.PAYSTACK_PLAN_AMOUNT_KES?.trim()
  const parsed = raw ? parseInt(raw, 10) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2000
}

export function paystackPlanCode(): string {
  return process.env.PAYSTACK_PLAN_CODE?.trim() ?? ''
}

// ---------------------------------------------------------------------------
// Paystack API response shapes
// ---------------------------------------------------------------------------

export type PaystackInitResult =
  | { ok: true; authorizationUrl: string; accessCode: string; reference: string }
  | { ok: false; error: string }

export type PaystackVerifyResult =
  | {
      ok: true
      status: 'success' | 'failed' | 'abandoned' | string
      reference: string
      amountMinor: number
      currency: string
      customerCode: string | null
      customerEmail: string
      metadata: Record<string, unknown> | null
    }
  | { ok: false; error: string }

export type PaystackSubscriptionResult =
  | { ok: true; subscriptionCode: string; emailToken: string }
  | { ok: false; error: string }

export type PaystackMobileMoneyResult =
  | { ok: true; reference: string; displayText: string }
  | { ok: false; error: string }

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function authHeader() {
  const key = process.env.PAYSTACK_SECRET_KEY?.trim()
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not set')
  return { authorization: `Bearer ${key}`, 'content-type': 'application/json' }
}

async function paystackPost<T = unknown>(
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; data: T | null; message: string }> {
  const response = await fetch(`${PAYSTACK_BASE}${path}`, {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  const payload = (await response.json().catch(() => null)) as {
    status?: boolean
    message?: string
    data?: T
  } | null

  if (!payload?.status) {
    return {
      ok: false,
      data: null,
      message: payload?.message ?? `HTTP ${response.status}`,
    }
  }

  return { ok: true, data: payload.data ?? null, message: payload.message ?? 'ok' }
}

async function paystackGet<T = unknown>(
  path: string,
): Promise<{ ok: boolean; data: T | null; message: string }> {
  const response = await fetch(`${PAYSTACK_BASE}${path}`, {
    method: 'GET',
    headers: authHeader(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  const payload = (await response.json().catch(() => null)) as {
    status?: boolean
    message?: string
    data?: T
  } | null

  if (!payload?.status) {
    return {
      ok: false,
      data: null,
      message: payload?.message ?? `HTTP ${response.status}`,
    }
  }

  return { ok: true, data: payload.data ?? null, message: payload.message ?? 'ok' }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise a one-time charge transaction.
 *
 * For card payments the returned `authorizationUrl` opens the Paystack hosted
 * checkout. For the inline popup, use the `accessCode` instead.
 */
export async function initializeTransaction(
  email: string,
  amountKes: number,
  metadata: Record<string, unknown> = {},
): Promise<PaystackInitResult> {
  try {
    type InitData = {
      authorization_url: string
      access_code: string
      reference: string
    }

    const result = await paystackPost<InitData>('/transaction/initialize', {
      email,
      amount: amountKes * 100,
      currency: 'KES',
      metadata,
    })

    if (!result.ok || !result.data) {
      return { ok: false, error: result.message }
    }

    return {
      ok: true,
      authorizationUrl: result.data.authorization_url,
      accessCode: result.data.access_code,
      reference: result.data.reference,
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** Verify a completed transaction by reference. */
export async function verifyTransaction(reference: string): Promise<PaystackVerifyResult> {
  try {
    type VerifyData = {
      status: string
      reference: string
      amount: number
      currency: string
      customer: { email: string; customer_code: string | null }
      metadata?: Record<string, unknown> | string | null
    }

    const result = await paystackGet<VerifyData>(`/transaction/verify/${encodeURIComponent(reference)}`)

    if (!result.ok || !result.data) {
      return { ok: false, error: result.message }
    }

    const d = result.data

    return {
      ok: true,
      status: d.status,
      reference: d.reference,
      amountMinor: d.amount,
      currency: d.currency,
      customerCode: d.customer?.customer_code ?? null,
      customerEmail: d.customer?.email ?? '',
      metadata:
        typeof d.metadata === 'string'
          ? parseMetadata(d.metadata)
          : d.metadata ?? null,
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function parseMetadata(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/** Initiate a Kenyan M-Pesa STK push through Paystack's Charge API. */
export async function initiateMobileMoneyCharge(
  email: string,
  amountKes: number,
  phone: string,
  metadata: Record<string, unknown> = {},
): Promise<PaystackMobileMoneyResult> {
  try {
    type ChargeData = { reference: string; status: string; display_text?: string }
    const result = await paystackPost<ChargeData>('/charge', {
      email,
      amount: amountKes * 100,
      currency: 'KES',
      mobile_money: { phone, provider: 'mpesa' },
      metadata,
    })

    if (!result.ok || !result.data || !result.data.reference) {
      return { ok: false, error: result.message }
    }

    return {
      ok: true,
      reference: result.data.reference,
      displayText: result.data.display_text ?? 'Approve the payment prompt on your phone.',
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Create a recurring subscription for a customer.
 *
 * Requires the customer code from a previous successful charge and the plan
 * code from the Paystack dashboard.
 */
export async function createSubscription(
  customerCode: string,
  planCode: string,
): Promise<PaystackSubscriptionResult> {
  try {
    type SubData = { subscription_code: string; email_token: string }

    const result = await paystackPost<SubData>('/subscription', {
      customer: customerCode,
      plan: planCode,
    })

    if (!result.ok || !result.data) {
      return { ok: false, error: result.message }
    }

    return {
      ok: true,
      subscriptionCode: result.data.subscription_code,
      emailToken: result.data.email_token,
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Verify an incoming Paystack webhook signature.
 *
 * Paystack signs the raw request body with HMAC-SHA512 using the secret key
 * and puts it in the `x-paystack-signature` header.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string,
): Promise<boolean> {
  const key = process.env.PAYSTACK_SECRET_KEY?.trim()
  if (!key) return false

  try {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(key)
    const bodyData = encoder.encode(rawBody)

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign'],
    )

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, bodyData)
    const computedHex = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    return computedHex === signature.toLowerCase()
  } catch {
    return false
  }
}
