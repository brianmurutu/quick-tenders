'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'

import {
  EMPTY_SIGN_UP,
  MIN_PASSWORD_LENGTH,
  validateSignUp,
  type SignUpFieldErrors,
  type SignUpInput,
} from '@/lib/signup'
import { INDUSTRIES, MAX_SECTORS, SECTORS } from '@/lib/company-profile'

import { signUp, type SignUpResult } from './actions'

type Status = 'idle' | 'submitting' | SignUpResult['status']

type Blocked = {
  message: string
  companyName: string | null
  representativeEmail: string
}

export function SignupForm({ initialError }: { initialError?: string }) {
  const formId = useId()
  const router = useRouter()
  const [values, setValues] = useState<SignUpInput>(EMPTY_SIGN_UP)
  const [fieldErrors, setFieldErrors] = useState<SignUpFieldErrors>({})
  const [formError, setFormError] = useState<string | undefined>(initialError)
  const [status, setStatus] = useState<Status>('idle')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [blocked, setBlocked] = useState<Blocked | null>(null)

  const submitting = status === 'submitting'

  function update<K extends keyof SignUpInput>(field: K, value: SignUpInput[K]) {
    setValues((current) => ({ ...current, [field]: value }))

    // Clear a field error as soon as the user starts fixing it.
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  function toggleSector(sector: string) {
    setValues((current) => {
      const selected = current.sectors_of_interest

      return {
        ...current,
        sectors_of_interest: selected.includes(sector)
          ? selected.filter((item) => item !== sector)
          : [...selected, sector],
      }
    })

    setFieldErrors((current) => {
      if (!current.sectors_of_interest) return current
      const next = { ...current }
      delete next.sectors_of_interest
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
      } else if (result.status === 'company-exists') {
        setBlocked({
          message: result.message,
          companyName: result.companyName,
          representativeEmail: result.representativeEmail,
        })
      } else if (result.status === 'confirm-email') {
        setConfirmEmail(result.email)
      } else if (result.status === 'ready') {
        // Confirmations are off, so there is already a session. Go straight in.
        router.replace('/onboarding')
      }

      setStatus(result.status)
    } catch {
      setFormError('Something went wrong sending that. Try again in a moment.')
      setStatus('error')
    }
  }

  if (status === 'company-exists' && blocked) {
    return (
      <Panel title="Your company already has an account">
        <p>{blocked.message}</p>
        {blocked.companyName ? (
          <p>
            The account is registered to{' '}
            <span className="font-semibold text-slate-900">{blocked.companyName}</span>
            . Quick Tenders allows one account per company, so there is nothing to
            set up a second time.
          </p>
        ) : (
          <p>
            Quick Tenders allows one account per company, so there is nothing to
            set up a second time.
          </p>
        )}
        <p className="flex flex-wrap gap-x-6 gap-y-2">
          <a
            href={`mailto:${blocked.representativeEmail}?subject=Quick%20Tenders%20access`}
            className="rounded-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
          >
            Email them for access
          </a>
          <Link
            href="/contact"
            className="rounded-sm font-semibold text-slate-700 transition-colors hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
          >
            Something looks wrong, get in touch
          </Link>
        </p>
      </Panel>
    )
  }

  if (status === 'confirm-email') {
    return (
      <Panel title="Check your email">
        <p>
          A confirmation link is on its way to{' '}
          <span className="font-semibold text-slate-900">{confirmEmail}</span>.
          Opening it finishes setting up your company, starts the 3-day trial, and
          takes you to onboarding.
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
        <p>Your company is set up. Taking you to onboarding now.</p>
        <p>
          <Link
            href="/onboarding"
            className="rounded-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
          >
            Continue to onboarding
          </Link>
        </p>
      </Panel>
    )
  }

  const selectedSectors = values.sectors_of_interest.length
  const sectorsHintId = `${formId}-sectors-hint`
  const sectorsErrorId = `${formId}-sectors-error`

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
        label="Category your company falls under"
        hint="This is the profile the agent scores every tender against, so it is worth getting right."
        error={fieldErrors.industry}
      >
        {(props) => (
          <select
            {...props}
            name="industry"
            value={values.industry}
            onChange={(event) => update('industry', event.target.value)}
          >
            <option value="">Select a category</option>
            {INDUSTRIES.map((industry) => (
              <option key={industry} value={industry}>
                {industry}
              </option>
            ))}
          </select>
        )}
      </Field>

      <fieldset
        aria-describedby={`${
          fieldErrors.sectors_of_interest ? `${sectorsErrorId} ` : ''
        }${sectorsHintId}`}
        aria-invalid={fieldErrors.sectors_of_interest ? true : undefined}
      >
        <legend className="text-sm font-semibold text-slate-900">
          Sectors you want tenders for
        </legend>

        {fieldErrors.sectors_of_interest ? (
          <p id={sectorsErrorId} className="mt-2 text-sm font-medium text-red-700">
            {fieldErrors.sectors_of_interest}
          </p>
        ) : null}

        <p id={sectorsHintId} className="mt-2 text-sm leading-relaxed text-slate-500">
          Pick between 1 and {MAX_SECTORS}. Narrower profiles match better than
          broad ones. Selected {selectedSectors} of {MAX_SECTORS}.
        </p>

        <div className="mt-4 grid max-h-64 gap-x-6 gap-y-3 overflow-y-auto rounded-md border border-slate-200 p-4 sm:grid-cols-2">
          {SECTORS.map((sector) => {
            const checked = values.sectors_of_interest.includes(sector)
            const atLimit = !checked && selectedSectors >= MAX_SECTORS

            return (
              <label
                key={sector}
                className={`flex items-start gap-3 text-sm ${
                  atLimit
                    ? 'cursor-not-allowed text-slate-400'
                    : 'cursor-pointer text-slate-700'
                }`}
              >
                <input
                  type="checkbox"
                  name="sectors_of_interest"
                  value={sector}
                  checked={checked}
                  disabled={atLimit}
                  onChange={() => toggleSector(sector)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed"
                />
                <span>{sector}</span>
              </label>
            )
          })}
        </div>

        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          You will add your county and company size on the next screen, and you can
          change any of this later.
        </p>
      </fieldset>

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
