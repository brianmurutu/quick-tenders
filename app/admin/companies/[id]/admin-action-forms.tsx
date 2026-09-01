'use client'

import { useActionState } from 'react'

import type { ExtendTrialState, SetPlanState } from './actions'
import { extendTrialAction, setPlanAction } from './actions'
import { resendAuthEmailAction, type ResendAuthResult } from '@/app/admin/auth-actions'
import { useState, useTransition } from 'react'

// ---------------------------------------------------------------------------
// Extend trial form
// ---------------------------------------------------------------------------

const EXTEND_INITIAL: ExtendTrialState = { ok: false, message: '' }

export function ExtendTrialForm({
  companyId,
  currentEndsAt,
}: {
  companyId: string
  currentEndsAt: string
}) {
  const bound = extendTrialAction.bind(null, companyId)
  const [state, formAction, pending] = useActionState(bound, EXTEND_INITIAL)

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
  }

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex items-end gap-3">
        <div>
          <label
            htmlFor="days"
            className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500"
          >
            Extend by (days)
          </label>
          <input
            id="days"
            name="days"
            type="number"
            min={1}
            max={365}
            defaultValue={7}
            required
            className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
        >
          {pending ? 'Extending…' : 'Extend trial'}
        </button>
      </div>

      <p className="text-xs text-slate-500">
        Current end:{' '}
        <span className="font-medium text-slate-700">
          {formatDate(state.newEndsAt ?? currentEndsAt)}
        </span>
      </p>

      {state.message ? (
        <p
          role="alert"
          className={`text-sm ${state.ok ? 'text-emerald-700' : 'text-red-700'}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  )
}

// ---------------------------------------------------------------------------
// Set plan form
// ---------------------------------------------------------------------------

const SET_PLAN_INITIAL: SetPlanState = { ok: false, message: '' }

export function SetPlanForm({
  companyId,
  currentPlan,
}: {
  companyId: string
  currentPlan: string
}) {
  const bound = setPlanAction.bind(null, companyId)
  const [state, formAction, pending] = useActionState(bound, SET_PLAN_INITIAL)

  const displayPlan = state.newPlan ?? currentPlan

  return (
    <form action={formAction} className="space-y-3">
      <fieldset>
        <legend className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
          Plan
        </legend>
        <div className="flex gap-4">
          {(['trial', 'paid'] as const).map((plan) => (
            <label key={plan} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="plan"
                value={plan}
                defaultChecked={displayPlan === plan}
                key={displayPlan} // re-mount when plan changes so checked state resets
                className="accent-blue-700"
              />
              <span className="capitalize text-sm text-slate-700">{plan}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        {pending ? 'Saving…' : 'Set plan'}
      </button>

      {state.message ? (
        <p
          role="alert"
          className={`text-sm ${state.ok ? 'text-emerald-700' : 'text-red-700'}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  )
}

// ---------------------------------------------------------------------------
// Resend Auth for representative
// ---------------------------------------------------------------------------

export function ResendRepAuthButton({ email }: { email: string }) {
  const [result, setResult] = useState<ResendAuthResult | null>(null)
  const [isPending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)

  function handleResend() {
    setResult(null)
    startTransition(async () => {
      const res = await resendAuthEmailAction(email)
      setResult(res)
    })
  }

  function handleCopy() {
    if (!result?.actionLink) return
    void navigator.clipboard.writeText(result.actionLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={handleResend}
        disabled={isPending}
        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
      >
        {isPending ? 'Sending…' : 'Resend Auth'}
      </button>

      {result && (
        <div className="flex items-center gap-2">
          <span
            className={`text-xs ${result.ok ? 'text-emerald-700' : 'text-red-600 font-medium'}`}
          >
            {result.ok ? 'Sent!' : result.message}
          </span>
          {result.actionLink && (
            <button
              type="button"
              onClick={handleCopy}
              className="text-[11px] underline text-blue-600 hover:text-blue-800"
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

