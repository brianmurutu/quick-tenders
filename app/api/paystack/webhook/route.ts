import { NextResponse, type NextRequest } from 'next/server'

import { isValidPlanAmountMinor, verifyWebhookSignature } from '@/lib/paystack'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database'

/**
 * Paystack webhook endpoint.
 *
 * Receives events from Paystack and updates the database accordingly.
 *
 * Security: every request is verified against the HMAC-SHA512 signature
 * Paystack places in `x-paystack-signature`. Requests that fail verification
 * are rejected with 401.
 *
 * Register this URL in the Paystack dashboard under:
 *   Settings → API Keys & Webhooks → Webhook URL
 *
 * URL: https://yourdomain.com/api/paystack/webhook
 */

export const dynamic = 'force-dynamic'

type PaystackWebhookEvent = {
  event: string
  data: {
    reference?: string
    status?: string
    amount?: number
    currency?: string
    customer?: {
      email?: string
      customer_code?: string
    }
    subscription_code?: string
    plan?: { plan_code?: string }
    metadata?: Record<string, unknown>
  }
}

/** Map from Paystack customer email → company_id using representatives table. */
async function companyIdForEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<string | null> {
  const { data } = await admin
    .from('representatives')
    .select('company_id')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle()

  return data?.company_id ?? null
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Read the raw body (needed for signature verification).
  const rawBody = await request.text()
  const signature = request.headers.get('x-paystack-signature') ?? ''

  // 2. Verify signature.
  const valid = await verifyWebhookSignature(rawBody, signature)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // 3. Parse event.
  let event: PaystackWebhookEvent
  try {
    event = JSON.parse(rawBody) as PaystackWebhookEvent
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: eventData } = event
  const customerEmail = eventData.customer?.email ?? ''
  const customerCode = eventData.customer?.customer_code ?? null
  const reference = eventData.reference ?? `webhook-${event.event}-${Date.now()}`
  const amountKes = eventData.amount ?? 0
  const currency = eventData.currency ?? 'KES'

  // 4. Handle supported events.
  switch (event.event) {
    case 'charge.success': {
      if (eventData.status !== 'success') break

      if (currency !== 'KES' || !isValidPlanAmountMinor(amountKes)) {
        console.warn(`[paystack-webhook] Ignoring unexpected payment amount/currency for ${reference}`)
        break
      }

      const companyId = await companyIdForEmail(admin, customerEmail)

      if (!companyId) {
        console.warn(`[paystack-webhook] No company found for email: ${customerEmail}`)
        // Still return 200 so Paystack does not retry an unresolvable event.
        break
      }

      // Upgrade the plan.
      await admin
        .from('companies')
        .update({
          plan: 'paid',
          ...(customerCode ? { paystack_customer_code: customerCode } : {}),
        })
        .eq('id', companyId)

      // Audit record.
      await admin.from('subscriptions').upsert(
        {
          company_id: companyId,
          paystack_reference: reference,
          event_type: 'charge.success',
          amount_kobo: amountKes,
          currency,
          status: 'success',
          payload: eventData as unknown as Json,
        },
        { onConflict: 'paystack_reference', ignoreDuplicates: true },
      )

      console.log(`[paystack-webhook] charge.success for company ${companyId}`)
      break
    }

    case 'subscription.create': {
      const subscriptionCode = eventData.subscription_code ?? null
      if (!subscriptionCode) break

      const companyId = await companyIdForEmail(admin, customerEmail)
      if (!companyId) break

      await admin
        .from('companies')
        .update({
          paystack_subscription_code: subscriptionCode,
          plan: 'paid',
        })
        .eq('id', companyId)

      await admin.from('subscriptions').insert({
        company_id: companyId,
        paystack_reference: reference,
        event_type: 'subscription.create',
        amount_kobo: amountKes,
        currency,
        status: 'active',
        payload: eventData as unknown as Json,
      })

      console.log(`[paystack-webhook] subscription.create for company ${companyId}`)
      break
    }

    case 'subscription.disable':
    case 'subscription.not_renew': {
      // Do not immediately downgrade — give the company a grace period or
      // handle manually. Just log it for now.
      console.log(`[paystack-webhook] ${event.event} for ${customerEmail}`)
      break
    }

    default:
      // Unknown events: acknowledge and ignore.
      break
  }

  // Always return 200 so Paystack does not retry.
  return NextResponse.json({ received: true })
}
