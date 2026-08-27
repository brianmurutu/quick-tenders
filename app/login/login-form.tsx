'use client'

import Link from 'next/link'
import { useId, useState } from 'react'

import {
  EMPTY_SIGN_IN,
  validateSignIn,
  type SignInFieldErrors,
  type SignInInput,
} from '@/lib/signin'

import { signIn } from './actions'

export function LoginForm({
  next,
  initialMessage,
}: {
  next?: string
  initialMessage?: string
}) {
  const formId = useId()
  const [values, setValues] = useState<SignInInput>(EMPTY_SIGN_IN)
  const [fieldErrors, setFieldErrors] = useState<SignInFieldErrors>({})
  const [formError, setFormError] = useState<string>()
  const [pending, setPending] = useState(false)

  function update<K extends keyof SignInInput>(field: K, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => {
      if (!current[field]) return current
      const nextErrors = { ...current }
      delete nextErrors[field]
      return nextErrors
    })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(undefined)

    const localErrors = validateSignIn(values)

    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors)
      return
    }

    setFieldErrors({})
    setPending(true)

    try {
      const result = await signIn(values, next)

      if (result.status === 'invalid') {
        setFieldErrors(result.fieldErrors)
        setPending(false)
        return
      }

      if (result.status === 'error') {
        setFormError(result.message)
        setPending(false)
        return
      }

      // A full document navigation rather than router.push, deliberately. The
      // session cookie has just changed, and a client side transition would reuse
      // the router cache populated while signed out. Reloading throws all of that
      // away, so nothing rendered for an anonymous visitor can leak into the
      // signed-in view. Left pending, since the page is about to be replaced.
      window.location.assign(result.next)
    } catch {
      setFormError('Something went wrong signing you in. Try again in a moment.')
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {initialMessage && !formError ? (
        <div
          role="status"
          className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700"
        >
          {initialMessage}
        </div>
      ) : null}

      {formError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm leading-relaxed text-red-900"
        >
          {formError}
        </div>
      ) : null}

      <Field id={`${formId}-email`} label="Company email" error={fieldErrors.email}>
        {(props) => (
          <input
            {...props}
            type="email"
            name="email"
            autoComplete="email"
            autoFocus
            value={values.email}
            onChange={(event) => update('email', event.target.value)}
          />
        )}
      </Field>

      <Field id={`${formId}-password`} label="Password" error={fieldErrors.password}>
        {(props) => (
          <input
            {...props}
            type="password"
            name="password"
            autoComplete="current-password"
            value={values.password}
            onChange={(event) => update('password', event.target.value)}
          />
        )}
      </Field>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-blue-700 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {pending ? 'Signing you in...' : 'Sign in'}
      </button>

      <p className="text-sm leading-relaxed text-slate-600">
        No account for your company yet?{' '}
        <Link
          href="/signup"
          className="rounded-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
        >
          Start a 3-day trial
        </Link>
        .
      </p>
    </form>
  )
}

const controlClasses =
  'w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 transition-colors focus:border-blue-700 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-blue-700'

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: (props: {
    id: string
    className: string
    'aria-invalid': boolean | undefined
    'aria-describedby': string | undefined
  }) => React.ReactNode
}) {
  const errorId = error ? `${id}-error` : undefined

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
          'aria-describedby': errorId,
        })}
      </div>

      {error ? (
        <p id={errorId} className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  )
}
