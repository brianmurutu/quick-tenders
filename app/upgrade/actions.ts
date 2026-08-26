'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  initializeTransaction,
  verifyTransaction,
  createSubscription,
  initiateMobileMoneyCharge,
  getSubscriptionPlan,
  isValidPlanAmountMinor,
  paystackPlanCode,
} from '@/lib/paystack'
import { normaliseKenyanPhone } from '@/lib/sms/textsms'

export type InitPaymentResult =
  | { status: 'ok'; accessCode: string; reference: string; amountMinor: number }
  | { status: 'error'; message: string }

export type MobileMoneyPaymentResult =
  | { status: 'pending'; reference: string; message: string }
  | { status: 'error'; message: string }

export type PaymentFailureReason =
  | 'cancelled'
  | 'insufficient_funds'
  | 'invalid_pin'
  | 'timeout'
  | 'declined'
  | 'generic'

export type VerifyPaymentResult =
  | { status: 'paid'; amountKes: number; planName: string }
  | { status: 'pending' }
  | { status: 'failed'; reason?: PaymentFailureReason; message: string }
  | { status: 'error'; message: string }

function parsePaymentFailure(
  gatewayResponse?: string | null,
  status?: string,
  message?: string | null,
): { reason: PaymentFailureReason; message: string } {
  const combined = `${gatewayResponse ?? ''} ${message ?? ''} ${status ?? ''}`.toLowerCase()

  if (
    combined.includes('cancel') ||
    combined.includes('user cancelled') ||
    combined.includes('request was cancelled')
  ) {
    return {
      reason: 'cancelled',
      message: 'The payment prompt was cancelled on the phone. You can try again whenever you are ready.',
    }
  }

  if (
    combined.includes('insufficient') ||
    combined.includes('not enough') ||
    combined.includes('low balance')
  ) {
    return {
      reason: 'insufficient_funds',
      message: 'Insufficient balance in your M-Pesa account. Please top up your account and try again.',
    }
  }

  if (
    combined.includes('pin') ||
    combined.includes('wrong pin') ||
    combined.includes('invalid pin')
  ) {
    return {
      reason: 'invalid_pin',
      message: 'Incorrect M-Pesa PIN entered. Please try again with your correct PIN.',
    }
  }

  if (
    combined.includes('timeout') ||
    combined.includes('timed out') ||
    combined.includes('no response')
  ) {
    return {
      reason: 'timeout',
      message: 'The payment prompt timed out waiting for approval. Please unlock your phone and try again.',
    }
  }

  if (combined.includes('declined') || combined.includes('rejected')) {
    return {
      reason: 'declined',
      message: gatewayResponse || 'Payment was declined by your provider. Please try again.',
    }
  }

  return {
    reason: 'generic',
    message:
      gatewayResponse ||
      message ||
      `Payment was not completed (Status: ${status || 'failed'}). Please try again.`,
  }
}

/**
 * Initialise a Paystack transaction for the signed-in company and chosen plan.
 *
 * Returns an access code (for the popup) and a reference (for verification).
 * The payment method choice (card vs mobile) is handled client-side; the
 * initialisation is the same for both.
 */
export async function initializePayment(planId?: string): Promise<InitPaymentResult> {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: 'error', message: 'You are not signed in.' }
  }

  const admin = createAdminClient()
  const { data: rep } = await admin
    .from('representatives')
    .select('company_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!rep?.company_id) {
    return { status: 'error', message: 'Your account is not attached to a company. Get in touch.' }
  }

  const plan = getSubscriptionPlan(planId)
  const amountKes = plan.amountKes

  const result = await initializeTransaction(user.email ?? '', amountKes, {
    user_id: user.id,
    company_id: rep.company_id,
    plan_id: plan.id,
    plan_name: plan.name,
    amount_kes: amountKes,
  })

  if (!result.ok) {
    return { status: 'error', message: `Payment initialisation failed: ${result.error}` }
  }

  return {
    status: 'ok',
    accessCode: result.accessCode,
    reference: result.reference,
    amountMinor: amountKes * 100,
  }
}

/** Start an M-Pesa STK push. Completion is confirmed through verification/webhook. */
export async function initiateMobileMoneyPayment(
  phoneNumber: string,
  planId?: string,
): Promise<MobileMoneyPaymentResult> {
  const phone = normaliseKenyanPhone(phoneNumber)
  if (!phone) return { status: 'error', message: 'Enter a valid Kenyan M-Pesa number.' }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { status: 'error', message: 'Your session has expired. Sign in and try again.' }

  const admin = createAdminClient()
  const { data: rep } = await admin
    .from('representatives')
    .select('company_id')
    .eq('id', user.id)
    .maybeSingle()
  if (!rep?.company_id) return { status: 'error', message: 'Your account is not attached to a company. Get in touch.' }

  const plan = getSubscriptionPlan(planId)
  const amountKes = plan.amountKes

  const charge = await initiateMobileMoneyCharge(user.email, amountKes, `+${phone}`, {
    user_id: user.id,
    company_id: rep.company_id,
    plan_id: plan.id,
    plan_name: plan.name,
    amount_kes: amountKes,
  })
  return charge.ok
    ? { status: 'pending', reference: charge.reference, message: charge.displayText }
    : { status: 'error', message: `Could not start M-Pesa payment: ${charge.error}` }
}

/**
 * Verify a Paystack transaction after the popup closes with success.
 *
 * On success, upgrades the company plan to 'paid' and optionally starts a
 * recurring subscription if a plan code is configured.
 */
export async function verifyPayment(
  reference: string,
  planId?: string,
): Promise<VerifyPaymentResult> {
  if (!reference) {
    return { status: 'error', message: 'No payment reference provided.' }
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: 'error', message: 'Your session has expired. Sign in and try again.' }
  }

  // Verify on server — never trust the client's "success" signal.
  const verification = await verifyTransaction(reference)

  if (!verification.ok) {
    return { status: 'error', message: `Could not verify payment: ${verification.error}` }
  }

  if (['pay_offline', 'pending', 'processing', 'ongoing'].includes(verification.status.toLowerCase())) {
    return { status: 'pending' }
  }

  if (verification.status !== 'success') {
    const failure = parsePaymentFailure(
      verification.gatewayResponse,
      verification.status,
      verification.message,
    )
    return {
      status: 'failed',
      reason: failure.reason,
      message: failure.message,
    }
  }

  // Use service role so we can write across the company row without RLS constraints.
  const admin = createAdminClient()

  // Find company for this user.
  const { data: rep } = await admin
    .from('representatives')
    .select('company_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!rep?.company_id) {
    return { status: 'error', message: 'Your account is not attached to a company. Get in touch.' }
  }

  const companyId = rep.company_id
  const customerCode = verification.customerCode ?? null

  const expectedPlan = planId ? getSubscriptionPlan(planId) : null
  const expectedAmountMinor = expectedPlan ? expectedPlan.amountKes * 100 : null
  const isValidAmount = expectedAmountMinor !== null
    ? verification.amountMinor === expectedAmountMinor
    : isValidPlanAmountMinor(verification.amountMinor)

  if (
    verification.customerEmail.toLowerCase() !== (user.email ?? '').toLowerCase() ||
    !isValidAmount ||
    verification.currency !== 'KES' ||
    verification.metadata?.user_id !== user.id ||
    verification.metadata?.company_id !== companyId
  ) {
    return { status: 'failed', reason: 'generic', message: 'This payment does not match your subscription details.' }
  }

  // Upgrade the plan.
  const { error: updateError } = await admin
    .from('companies')
    .update({
      plan: 'paid',
      ...(customerCode ? { paystack_customer_code: customerCode } : {}),
    })
    .eq('id', companyId)

  if (updateError) {
    return { status: 'error', message: 'Payment verified but plan upgrade failed. Contact support.' }
  }

  // Record the payment event in the audit table.
  await admin.from('subscriptions').insert({
    company_id: companyId,
    paystack_reference: reference,
    event_type: 'charge.success',
    amount_kobo: verification.amountMinor,
    currency: 'KES',
    status: 'success',
    payload: { reference, customerCode, email: verification.customerEmail },
  })

  // Optionally start a recurring subscription.
  const planCode = paystackPlanCode()
  if (planCode && customerCode) {
    const sub = await createSubscription(customerCode, planCode)
    if (sub.ok) {
      await admin
        .from('companies')
        .update({ paystack_subscription_code: sub.subscriptionCode })
        .eq('id', companyId)
    }
  }

  return {
    status: 'paid',
    amountKes: verification.amountMinor / 100,
    planName: expectedPlan?.name ?? 'Quick Tenders',
  }
}
