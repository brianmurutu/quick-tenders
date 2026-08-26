'use client'

import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'

import {
  SUBSCRIPTION_PLANS,
  type SubscriptionPlanId,
} from '@/lib/paystack'

import { initializePayment, initiateMobileMoneyPayment, verifyPayment } from './actions'

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
  const [method, setMethod] = useState<PaymentMethod>('card')
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string>()

  const selectedPlan =
    SUBSCRIPTION_PLANS.find((p) => p.id === selectedPlanId) ?? SUBSCRIPTION_PLANS[0]

  const pending = status === 'initialising' || status === 'waiting' || status === 'verifying'

  async function handlePay() {
    setError(undefined)
    setStatus('initialising')

    try {
      if (method === 'mpesa') {
        const mobile = await initiateMobileMoneyPayment(phone, selectedPlan.id)
        if (mobile.status === 'error') {
          setError(mobile.message)
          setStatus('error')
          return
        }
        setStatus('waiting')
        setError(mobile.message)
        await pollForPayment(mobile.reference, selectedPlan.id)
        return
      }

      const init = await initializePayment(selectedPlan.id)

      if (init.status === 'error') {
        setError(init.message)
        setStatus('error')
        return
      }

      await loadPaystackScript()

      setStatus('waiting')

      const popup = window.PaystackPop.setup({
        key: paystackPublicKey,
        email: companyEmail,
        amount: init.amountMinor,
        currency: 'KES',
        ref: init.reference,
        accessCode: init.accessCode,
        channels: ['card'],
        metadata: { payment_method: 'card', plan_id: selectedPlan.id },
        onClose: () => {
          setStatus('idle')
        },
        callback: async (response) => {
          setStatus('verifying')
          const result = await verifyPayment(response.reference, selectedPlan.id)

          if (result.status === 'paid') {
            setStatus('paid')
            // Hard reload so the session + plan state refreshes fully.
            setTimeout(() => router.replace('/dashboard'), 1500)
          } else if (result.status === 'pending') {
            setError('Payment is still pending. Complete the prompt on your phone.')
            setStatus('waiting')
          } else {
            setError(result.message)
            setStatus('failed')
          }
        },
      })

      popup.openIframe()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
      setStatus('error')
    }
  }

  async function pollForPayment(reference: string, planId: SubscriptionPlanId) {
    const deadline = Date.now() + 180_000
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 5_000))
      const result = await verifyPayment(reference, planId)
      if (result.status === 'paid') {
        setStatus('paid')
        setTimeout(() => router.replace('/dashboard'), 1500)
        return
      }
      if (result.status === 'pending') continue
      if (result.status === 'failed') {
        setError(result.message)
        setStatus('failed')
        return
      }
    }
    setError('We could not confirm the payment yet. It may still complete shortly.')
    setStatus('failed')
  }

  if (status === 'paid') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-7">
        <h2 className="text-xl font-semibold text-emerald-900">Payment successful</h2>
        <p className="mt-3 text-sm leading-relaxed text-emerald-800">
          Your subscription is active. Taking you to the dashboard now.
        </p>
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
                onClick={() => setSelectedPlanId(plan.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedPlanId(plan.id)
                  }
                }}
                className={`relative flex cursor-pointer flex-col justify-between rounded-xl border p-6 text-left transition-all ${
                  isSelected
                    ? 'border-blue-700 bg-blue-50/40 shadow-sm ring-2 ring-blue-700'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                }`}
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

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <MethodButton
            id={`${formId}-card`}
            value="card"
            selected={method === 'card'}
            label="Card"
            description="Visa, Mastercard, or Amex"
            icon={<CardIcon />}
            onChange={() => setMethod('card')}
          />
          <MethodButton
            id={`${formId}-mpesa`}
            value="mpesa"
            selected={method === 'mpesa'}
            label="Mobile Money"
            description="M-Pesa STK push"
            icon={<PhoneIcon />}
            onChange={() => setMethod('mpesa')}
          />
        </div>
      </div>

      {method === 'mpesa' && (
        <div>
          <label
            htmlFor={`${formId}-phone`}
            className="block text-sm font-semibold text-slate-900"
          >
            M-Pesa phone number
          </label>
          <p className="mt-1 text-sm text-slate-500">
            The number that will receive the STK push prompt. Format: 07XX or +2547XX.
          </p>
          <div className="mt-2">
            <input
              id={`${formId}-phone`}
              type="tel"
              autoComplete="tel"
              placeholder="0712 345 678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 transition-colors focus:border-blue-700 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-blue-700"
            />
          </div>
        </div>
      )}

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm leading-relaxed text-red-900"
        >
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handlePay}
        disabled={pending}
        className="w-full rounded-md bg-blue-700 px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {status === 'initialising'
          ? 'Opening payment…'
          : status === 'waiting'
            ? 'Complete in the payment window…'
            : status === 'verifying'
              ? 'Confirming payment…'
              : `Pay ${formattedAmount} with ${method === 'mpesa' ? 'M-Pesa' : 'card'}`}
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
