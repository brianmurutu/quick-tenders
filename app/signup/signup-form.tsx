'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useId, useState } from 'react'

import { GoogleAuthButton } from '@/components/auth/google-auth-button'
import { TurnstileWidget } from '@/components/auth/turnstile-widget'
import { Button, Card, CheckboxChip, Input, Select } from '@/components/ui'
import {
  EMPTY_SIGN_UP,
  MIN_PASSWORD_LENGTH,
  validateSignUp,
  type SignUpFieldErrors,
  type SignUpInput,
} from '@/lib/signup'
import { INDUSTRIES, MAX_SECTORS, SECTORS } from '@/lib/company-profile'

import {
  resendSignupConfirmation,
  signUp,
  type SignUpResult,
} from './actions'

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
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaResetVersion, setCaptchaResetVersion] = useState(0)
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState<string>()
  const captchaRequired =
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim())

  const submitting = status === 'submitting'
  const handleCaptchaToken = useCallback((token: string | null) => {
    setCaptchaToken(token)
  }, [])

  const resetCaptcha = useCallback(() => {
    setCaptchaToken(null)
    setCaptchaResetVersion((version) => version + 1)
  }, [])

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
      const result = await signUp(values, captchaToken ?? undefined)
      resetCaptcha()

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
      resetCaptcha()
    }
  }

  async function handleResendConfirmation() {
    setResending(true)
    setResendMessage(undefined)

    try {
      const result = await resendSignupConfirmation(
        confirmEmail,
        captchaToken ?? undefined,
      )
      resetCaptcha()
      setResendMessage(
        result.status === 'sent'
          ? 'If this account still needs confirmation, a new link has been requested. Check your inbox and spam folder.'
          : result.message,
      )
    } catch {
      resetCaptcha()
      setResendMessage('We could not resend the confirmation email just now. Try again shortly.')
    } finally {
      setResending(false)
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
          If it is not there, check your spam folder. Confirmation links expire,
          so use the newest one you receive.
        </p>
        <TurnstileWidget
          action="google_auth"
          onToken={handleCaptchaToken}
          resetVersion={captchaResetVersion}
        />
        {resendMessage ? (
          <p role="status" className="text-sm text-slate-700">{resendMessage}</p>
        ) : null}
        <Button
          type="button"
          onClick={handleResendConfirmation}
          disabled={resending || (captchaRequired && !captchaToken)}
          className="w-full"
        >
          {resending ? 'Requesting a new link...' : 'Resend confirmation email'}
        </Button>
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
    <form onSubmit={handleSubmit} noValidate className="auth-form">
      {formError ? (
        <div role="alert" className="form-message form-message-error">
          {formError}
        </div>
      ) : null}

      <TurnstileWidget
        action="google_auth"
        onToken={handleCaptchaToken}
        resetVersion={captchaResetVersion}
      />

      <GoogleAuthButton
        flow="signup"
        captchaToken={captchaToken}
        resetCaptcha={resetCaptcha}
      />
      <div className="flex items-center gap-3 text-xs text-slate-400" aria-hidden="true">
        <span className="h-px flex-1 bg-slate-200" />
        <span>or sign up with your company email</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <Input
        id={`${formId}-full-name`}
        label="Your name"
        type="text"
        name="fullName"
        autoComplete="name"
        value={values.fullName}
        onChange={(event) => update('fullName', event.target.value)}
        error={fieldErrors.fullName}
      />

      <Input
        id={`${formId}-email`}
        label="Company email"
        helperText="Consumer email providers are not accepted, because the account is tied to your company domain."
        type="email"
        name="email"
        autoComplete="email"
        value={values.email}
        onChange={(event) => update('email', event.target.value)}
        error={fieldErrors.email}
      />

      <Input
        id={`${formId}-password`}
        label="Password"
        helperText={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        type="password"
        name="password"
        autoComplete="new-password"
        value={values.password}
        onChange={(event) => update('password', event.target.value)}
        error={fieldErrors.password}
      />

      <Input
        id={`${formId}-company-name`}
        label="Company name"
        type="text"
        name="companyName"
        autoComplete="organization"
        value={values.companyName}
        onChange={(event) => update('companyName', event.target.value)}
        error={fieldErrors.companyName}
      />

      <Select
        id={`${formId}-industry`}
        label="Category your company falls under"
        helperText="This is the profile the agent scores every tender against, so it is worth getting right."
        name="industry"
        value={values.industry}
        onChange={(event) => update('industry', event.target.value)}
        error={fieldErrors.industry}
      >
        <option value="">Select a category</option>
        {INDUSTRIES.map((industry) => (
          <option key={industry} value={industry}>
            {industry}
          </option>
        ))}
      </Select>

      <fieldset
        aria-describedby={`${
          fieldErrors.sectors_of_interest ? `${sectorsErrorId} ` : ''
        }${sectorsHintId}`}
        aria-invalid={fieldErrors.sectors_of_interest ? true : undefined}
      >
        <legend className="ui-label">Sectors you want tenders for</legend>

        {fieldErrors.sectors_of_interest ? (
          <p id={sectorsErrorId} className="ui-error">
            {fieldErrors.sectors_of_interest}
          </p>
        ) : null}

        <p id={sectorsHintId} className="ui-helper">
          Pick between 1 and {MAX_SECTORS}. Narrower profiles match better than
          broad ones. Selected {selectedSectors} of {MAX_SECTORS}.
        </p>

        <div className="checkbox-chip-grid">
          {SECTORS.map((sector) => {
            const checked = values.sectors_of_interest.includes(sector)
            const atLimit = !checked && selectedSectors >= MAX_SECTORS

            return (
              <CheckboxChip
                key={sector}
                name="sectors_of_interest"
                value={sector}
                checked={checked}
                disabled={atLimit}
                onChange={() => toggleSector(sector)}
              >
                {sector}
              </CheckboxChip>
            )
          })}
        </div>

        <p className="ui-helper">
          You will add your county and company size on the next screen, and you can
          change any of this later.
        </p>
      </fieldset>

      <Button
        type="submit"
        disabled={submitting || (captchaRequired && !captchaToken)}
        className="w-full"
      >
        {submitting ? 'Creating your account...' : 'Start the 3-day trial'}
      </Button>

      <p className="auth-copy">
        By signing up you agree to the{' '}
        <Link
          href="/terms"
          className="form-link"
        >
          terms of service
        </Link>{' '}
        and the{' '}
        <Link
          href="/privacy"
          className="form-link"
        >
          privacy policy
        </Link>
        .
      </p>
    </form>
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
    <Card className="signup-response-panel">
      <h2 className="text-xl font-semibold tracking-tight text-slate-900">
        {title}
      </h2>
      <div className="mt-4 space-y-4 leading-relaxed text-slate-600">{children}</div>
    </Card>
  )
}
