'use client'

import Link from 'next/link'
import { useId, useState } from 'react'

import {
  EMPTY_SIGN_IN,
  validateSignIn,
  type SignInFieldErrors,
  type SignInInput,
} from '@/lib/signin'
import { Button, Input } from '@/components/ui'

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
    <form onSubmit={handleSubmit} noValidate className="auth-form">
      {initialMessage && !formError ? (
        <div
          role="status"
          className="form-message"
        >
          {initialMessage}
        </div>
      ) : null}

      {formError ? (
        <div
          role="alert"
          className="form-message form-message-error"
        >
          {formError}
        </div>
      ) : null}

      <Input
        id={`${formId}-email`}
        label="Company email"
        error={fieldErrors.email}
        type="email"
        name="email"
        autoComplete="email"
        autoFocus
        value={values.email}
        onChange={(event) => update('email', event.target.value)}
      />

      <Input
        id={`${formId}-password`}
        label="Password"
        error={fieldErrors.password}
        type="password"
        name="password"
        autoComplete="current-password"
        value={values.password}
        onChange={(event) => update('password', event.target.value)}
      />

      <Button
        type="submit"
        disabled={pending}
        className="w-full"
      >
        {pending ? 'Signing you in...' : 'Sign in'}
      </Button>

      <p className="auth-copy">
        No account for your company yet?{' '}
        <Link
          href="/signup"
          className="form-link"
        >
          Start a 3-day trial
        </Link>
        .
      </p>
    </form>
  )
}
