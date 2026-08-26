'use client'

import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'

import {
  SUBSCRIPTION_PLANS,
  type SubscriptionPlanId,
} from '@/lib/paystack'

import {
  initializePayment,
  verifyPayment,
  type PaymentFailureReason,
} from './actions'

type PaymentMethod = 'card' | 'mpesa'
type Status = 'idle' | 'initialising' | 'waiting' | 'verifying' | 'paid' | 'failed' | 'error'

declare global {
  interface Window {
    // Paystack Inline popup
    PaystackPop: {
      setup(options: {
        key: string
        email: string
        amount: number
        currency: string
        ref: string
        accessCode?: string
        channels?: string[]
        metadata?: Record<string, unknown>
        onClose: () => void
        callback: (response: { reference: string; status: string }) => void
      }): { openIframe(): void }
    }
  }
}

function loadPaystackScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://js.paystack.co/v1/inline.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Paystack'))
    document.head.appendChild(script)
  })
}

function formatKes(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function PaymentForm({
  companyEmail,
  paystackPublicKey,
  defaultPlanId = 'starter',
}: {
  companyEmail: string
  paystackPublicKey: string
  defaultPlanId?: SubscriptionPlanId
}) {
  const formId = useId()
  const router = useRouter()
  const [selectedPlanId, setSelectedPlanId] = useState<SubscriptionPlanId>(defaultPlanId)
  const [method, setMethod] = useState<PaymentMethod>('mpesa')
  const [status, setStatus] = useState<Status>('idle')
  const [failureReason, setFailureReason] = useState<PaymentFailureReason>()
  const [error, setError] = useState<string>()
  const [successInfo, setSuccessInfo] = useState<{ amountKes: number; planName: string }>()

  const selectedPlan =
    SUBSCRIPTION_PLANS.find((p) => p.id === selectedPlanId) ?? SUBSCRIPTION_PLANS[0]

  const pending = status === 'initialising' || status === 'waiting' || status === 'verifying'

  async function handlePay() {
    setError(undefined)
    setFailureReason(undefined)
    setStatus('initialising')

    try {
      const init = await initializePayment(selectedPlan.id)

      if (init.status === 'error') {
        setError(init.message)
        setFailureReason('generic')
        setStatus('error')
        return
      }

      await loadPaystackScript()

      setStatus('waiting')

      // Open standard Paystack multi-option popup
      const channels = method === 'card' ? ['card', 'mobile_money'] : ['mobile_money', 'card']

      const popup = window.PaystackPop.setup({
        key: paystackPublicKey,
        email: companyEmail,
        amount: init.amountMinor,
        currency: 'KES',
        ref: init.reference,
        accessCode: init.accessCode,
        channels,
        metadata: {
          payment_method: method,
          plan_id: selectedPlan.id,
          plan_name: selectedPlan.name,
        },
        callback: function (response: { reference: string; status: string }) {
          void handleSuccessCallback(response.reference)
        },
        onClose: function () {
          setStatus('idle')
          setError('Payment window was closed. You can retry whenever you are ready.')
          setFailureReason('cancelled')
        },
      })

      popup.openIframe()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong opening the payment window. Try again.')
      setFailureReason('generic')
      setStatus('error')
    }
  }

  async function handleSuccessCallback(reference: string) {
    setStatus('verifying')
    try {
      const result = await verifyPayment(reference, selectedPlan.id)

      if (result.status === 'paid') {
        setStatus('paid')
        setSuccessInfo({ amountKes: result.amountKes, planName: result.planName })
        router.refresh()
        setTimeout(() => {
          router.replace('/dashboard')
        }, 1200)
      } else if (result.status === 'pending') {
        setError('Payment is still processing. Confirming with provider...')
        setStatus('waiting')
      } else {
        setError(result.message)
        setFailureReason(result.status === 'failed' ? result.reason : 'generic')
        setStatus(result.status === 'failed' ? 'failed' : 'error')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify payment. Please refresh or contact support.')
      setFailureReason('generic')
      setStatus('error')
    }
  }

  if (status === 'paid') {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-7 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">
            <CheckCircleIcon />
          </div>
          <div>
            <h2 className="text-xl font-bold text-emerald-950">Payment successful!</h2>
            <p className="mt-1 text-sm leading-relaxed text-emerald-800">
              Your subscription to{' '}
              <strong className="font-semibold text-emerald-950">
                {successInfo?.planName ?? selectedPlan.name}
              </strong>{' '}
              ({formatKes(successInfo?.amountKes ?? selectedPlan.amountKes)}) is now active.
            </p>
            <div className="mt-4 flex items-center gap-3 text-sm font-medium text-emerald-900">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-600"></span>
              </span>
              Redirecting you to the dashboard...
            </div>
          </div>
        </div>
      </div>
    )
  }

  const formattedAmount = formatKes(selectedPlan.amountKes)

  return (
    <div className="space-y-8">
      {/* Plan selection */}
      <div>
        <label className="block text-sm font-semibold text-slate-900">
          Choose a subscription plan
        </label>
        <p className="mt-1 text-sm text-slate-500">
          Select the plan that fits your current needs. You can switch or cancel anytime.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isSelected = plan.id === selectedPlanId
            return (
              <div
                key={plan.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (!pending) setSelectedPlanId(plan.id)
                }}
                onKeyDown={(e) => {
                  if (!pending && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    setSelectedPlanId(plan.id)
                  }
                }}
                className={`relative flex cursor-pointer flex-col justify-between rounded-xl border p-6 text-left transition-all ${
                  isSelected
                    ? 'border-blue-700 bg-blue-50/40 shadow-sm ring-2 ring-blue-700'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                } ${pending ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
                      {plan.name}
                    </p>
                    {plan.badge ? (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          isSelected
                            ? 'bg-blue-700 text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {plan.badge}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
                    {formatKes(plan.amountKes)}
                    <span className="ml-1 text-sm font-normal text-slate-500">
                      /{plan.interval}
                    </span>
                  </p>

                  <p className="mt-2 text-xs leading-relaxed text-slate-600">
                    {plan.description}
                  </p>

                  <ul className="mt-4 space-y-2">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2.5 text-xs text-slate-700"
                      >
                        <CheckIcon />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200/80 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600">
                    {isSelected ? 'Selected' : 'Click to select'}
                  </span>
                  <div
                    className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                      isSelected
                        ? 'border-blue-700 bg-blue-700'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isSelected && (
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Payment method selector */}
      <div>
        <p className="text-sm font-semibold text-slate-900">Payment method</p>
        <p className="mt-1 text-sm text-slate-500">
          Choose your preferred method. A secure Paystack window will open with all options.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <MethodButton
            id={`${formId}-mpesa`}
            value="mpesa"
            selected={method === 'mpesa'}
            label="Mobile Money"
            description="M-Pesa (STK Push & Paybill) or Airtel Money"
            icon={<PhoneIcon />}
            onChange={() => !pending && setMethod('mpesa')}
          />
          <MethodButton
            id={`${formId}-card`}
            value="card"
            selected={method === 'card'}
            label="Card"
            description="Visa, Mastercard, or American Express"
            icon={<CardIcon />}
            onChange={() => !pending && setMethod('card')}
          />
        </div>
      </div>

      {/* Real-time Failure & Error Notifications */}
      {error ? (
        <div
          role="alert"
          className={`rounded-lg border p-4 text-sm leading-relaxed transition-all ${
            failureReason === 'cancelled'
              ? 'border-amber-300 bg-amber-50 text-amber-900'
              : failureReason === 'insufficient_funds'
                ? 'border-rose-300 bg-rose-50 text-rose-900 font-medium'
                : failureReason === 'invalid_pin'
                  ? 'border-rose-300 bg-rose-50 text-rose-900 font-medium'
                  : failureReason === 'timeout'
                    ? 'border-amber-300 bg-amber-50 text-amber-900'
                    : 'border-red-300 bg-red-50 text-red-900'
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="text-lg">
              {failureReason === 'cancelled' && '🚫'}
              {failureReason === 'insufficient_funds' && '⚠️'}
              {failureReason === 'invalid_pin' && '🔒'}
              {failureReason === 'timeout' && '⏱️'}
              {(!failureReason || failureReason === 'generic' || failureReason === 'declined') && '❌'}
            </span>
            <div>
              {failureReason === 'insufficient_funds' ? (
                <p className="font-bold">Insufficient Balance</p>
              ) : failureReason === 'cancelled' ? (
                <p className="font-bold">Payment Cancelled</p>
              ) : failureReason === 'invalid_pin' ? (
                <p className="font-bold">Incorrect PIN</p>
              ) : failureReason === 'timeout' ? (
                <p className="font-bold">Request Timed Out</p>
              ) : null}
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={handlePay}
        disabled={pending}
        className="w-full rounded-md bg-blue-700 px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {status === 'initialising'
          ? 'Opening payment window…'
          : status === 'waiting'
            ? 'Complete payment in Paystack window…'
            : status === 'verifying'
              ? 'Confirming payment…'
              : `Pay ${formattedAmount} with ${method === 'mpesa' ? 'Mobile Money' : 'Card'}`}
      </button>

      <p className="text-center text-xs leading-relaxed text-slate-400">
        Payments are processed securely by{' '}
        <a
          href="https://paystack.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-slate-600"
        >
          Paystack
        </a>
        . Quick Tenders does not store card details.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MethodButton({
  id,
  value,
  selected,
  label,
  description,
  icon,
  onChange,
}: {
  id: string
  value: string
  selected: boolean
  label: string
  description: string
  icon: React.ReactNode
  onChange: () => void
}) {
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
        selected
          ? 'border-blue-700 bg-blue-50 ring-1 ring-blue-700'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <input
        id={id}
        type="radio"
        name="payment-method"
        value={value}
        checked={selected}
        onChange={onChange}
        className="sr-only"
      />
      <span className="mt-0.5 text-blue-700">{icon}</span>
      <span>
        <span className="block text-sm font-semibold text-slate-900">{label}</span>
        <span className="block text-xs text-slate-500">{description}</span>
      </span>
    </label>
  )
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0 text-blue-700"
    >
      <path d="m4 10.5 4 4 8-9" />
    </svg>
  )
}

function CardIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function CheckCircleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}
