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

export type VerifyPaymentResult =
  | { status: 'paid' }
  | { status: 'pending' }
  | { status: 'failed'; message: string }
  | { status: 'error'; message: string }

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

  if (['pay_offline', 'pending', 'processing'].includes(verification.status)) {
    return { status: 'pending' }
  }

  if (verification.status !== 'success') {
    return {
      status: 'failed',
      message: `Payment status was "${verification.status}". Please try again or contact support.`,
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
    return { status: 'failed', message: 'This payment does not match your subscription.' }
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

  return { status: 'paid' }
}
