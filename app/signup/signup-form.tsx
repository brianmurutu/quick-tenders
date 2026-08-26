'use client'

import Link from 'next/link'
import { useId, useState } from 'react'

import {
  COMPANY_SIZES,
  EMPTY_SIGN_UP,
  INDUSTRIES,
  MIN_PASSWORD_LENGTH,
  REGIONS,
  validateSignUp,
  type SignUpFieldErrors,
  type SignUpInput,
} from '@/lib/signup'

import { signUp, type SignUpResult } from './actions'

type Status = 'idle' | 'submitting' | SignUpResult['status']

export function SignupForm({ initialError }: { initialError?: string }) {
  const formId = useId()
  const [values, setValues] = useState<SignUpInput>(EMPTY_SIGN_UP)
  const [fieldErrors, setFieldErrors] = useState<SignUpFieldErrors>({})
  const [formError, setFormError] = useState<string | undefined>(initialError)
  const [status, setStatus] = useState<Status>('idle')
  const [confirmEmail, setConfirmEmail] = useState('')

  const submitting = status === 'submitting'

  function update<K extends keyof SignUpInput>(field: K, value: string) {
    setValues((current) => ({ ...current, [field]: value }))

    // Clear a field error as soon as the user starts fixing it.
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setFormError(undefined)

    const localErrors = validateSignUp(values)

    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors)
      setStatus('invalid')
      return
    }

    setFieldErrors({})
    setStatus('submitting')

    try {
      const result = await signUp(values)

      if (result.status === 'invalid') {
        setFieldErrors(result.fieldErrors)
      } else if (result.status === 'error') {
        setFormError(result.message)
      } else if (result.status === 'confirm-email') {
        setConfirmEmail(result.email)
      }

      setStatus(result.status)
    } catch {
      setFormError('Something went wrong sending that. Try again in a moment.')
      setStatus('error')
    }
  }

  if (status === 'confirm-email') {
    return (
      <Panel title="Check your email">
        <p>
          A confirmation link is on its way to{' '}
          <span className="font-semibold text-slate-900">{confirmEmail}</span>.
          Opening it finishes setting up your company and starts the 3-day trial.
        </p>
        <p>
          Nothing has been created yet, so if the address is wrong you can simply
          sign up again. Links expire, so use the newest one you receive.
        </p>
      </Panel>
    )
  }

  if (status === 'ready') {
    return (
      <Panel title="Account created">
        <p>
          Your company is set up and the 3-day trial has started. The agent begins
          matching against your profile straight away.
        </p>
        <p>
          <Link
            href="/"
            className="rounded-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
          >
            Back to the home page
          </Link>
        </p>
      </Panel>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {formError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm leading-relaxed text-red-900"
        >
          {formError}
        </div>
      ) : null}

      <Field
        id={`${formId}-full-name`}
        label="Your name"
        error={fieldErrors.fullName}
      >
        {(props) => (
          <input
            {...props}
            type="text"
            name="fullName"
            autoComplete="name"
            value={values.fullName}
            onChange={(event) => update('fullName', event.target.value)}
          />
        )}
      </Field>

      <Field
        id={`${formId}-email`}
        label="Company email"
        hint="Consumer email providers are not accepted, because the account is tied to your company domain."
        error={fieldErrors.email}
      >
        {(props) => (
          <input
            {...props}
            type="email"
            name="email"
            autoComplete="email"
            value={values.email}
            onChange={(event) => update('email', event.target.value)}
          />
        )}
      </Field>

      <Field
        id={`${formId}-password`}
        label="Password"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        error={fieldErrors.password}
      >
        {(props) => (
          <input
            {...props}
            type="password"
            name="password"
            autoComplete="new-password"
            value={values.password}
            onChange={(event) => update('password', event.target.value)}
          />
        )}
      </Field>

      <Field
        id={`${formId}-company-name`}
        label="Company name"
        error={fieldErrors.companyName}
      >
        {(props) => (
          <input
            {...props}
            type="text"
            name="companyName"
            autoComplete="organization"
            value={values.companyName}
            onChange={(event) => update('companyName', event.target.value)}
          />
        )}
      </Field>

      <Field
        id={`${formId}-industry`}
        label="Industry"
        error={fieldErrors.industry}
      >
        {(props) => (
          <select
            {...props}
            name="industry"
            value={values.industry}
            onChange={(event) => update('industry', event.target.value)}
          >
            <option value="">Select an industry</option>
            {INDUSTRIES.map((industry) => (
              <option key={industry} value={industry}>
                {industry}
              </option>
            ))}
          </select>
        )}
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          id={`${formId}-region`}
          label="Where you bid"
          error={fieldErrors.region}
        >
          {(props) => (
            <select
              {...props}
              name="region"
              value={values.region}
              onChange={(event) => update('region', event.target.value)}
            >
              <option value="">Select a scope</option>
              {REGIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field
          id={`${formId}-company-size`}
          label="Company size"
          error={fieldErrors.companySize}
        >
          {(props) => (
            <select
              {...props}
              name="companySize"
              value={values.companySize}
              onChange={(event) => update('companySize', event.target.value)}
            >
              <option value="">Select a size</option>
              {COMPANY_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} people
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-blue-700 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {submitting ? 'Creating your account...' : 'Start the 3-day trial'}
      </button>

      <p className="text-sm leading-relaxed text-slate-500">
        By signing up you agree to the{' '}
        <Link
          href="/terms"
          className="rounded-sm font-semibold text-slate-700 underline transition-colors hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
        >
          terms of service
        </Link>{' '}
        and the{' '}
        <Link
          href="/privacy"
          className="rounded-sm font-semibold text-slate-700 underline transition-colors hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
        >
          privacy policy
        </Link>
        .
      </p>
    </form>
  )
}

const controlClasses =
  'w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 transition-colors placeholder:text-slate-400 focus:border-blue-700 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-blue-700'

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: (props: {
    id: string
    className: string
    'aria-invalid': boolean | undefined
    'aria-describedby': string | undefined
  }) => React.ReactNode
}) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-900">
        {label}
      </label>

      <div className="mt-2">
        {children({
          id,
          className: error
            ? `${controlClasses} border-red-400 focus:border-red-500 focus:outline-red-500`
            : controlClasses,
          'aria-invalid': error ? true : undefined,
          'aria-describedby': describedBy,
        })}
      </div>

      {error ? (
        <p id={errorId} className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      {hint ? (
        <p id={hintId} className="mt-2 text-sm leading-relaxed text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

function Panel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-7">
      <h2 className="text-xl font-semibold tracking-tight text-slate-900">
        {title}
      </h2>
      <div className="mt-4 space-y-4 leading-relaxed text-slate-600">{children}</div>
    </div>
  )
}
