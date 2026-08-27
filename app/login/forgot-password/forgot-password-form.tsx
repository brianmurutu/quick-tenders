'use client'

import Link from 'next/link'
import { useId, useState } from 'react'

import { requestPasswordReset } from './actions'

export function ForgotPasswordForm() {
  const id = useId()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string>()
  const [sent, setSent] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(undefined)

    if (!email.trim()) {
      setError('Enter your email address.')
      return
    }

    setPending(true)

    try {
      const result = await requestPasswordReset(email)

      if (result.status === 'error') {
        setError(result.message)
        setPending(false)
        return
      }

      setSent(true)
    } catch {
      setError('Something went wrong. Try again in a moment.')
      setPending(false)
    }
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-7">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Check your inbox</h2>
        <div className="mt-4 space-y-4 leading-relaxed text-slate-600">
          <p>
            If <span className="font-semibold text-slate-900">{email}</span> is registered, a
            reset link is on its way. It expires in one hour.
          </p>
          <p>
            Nothing arrived? Check your spam folder, or{' '}
            <Link
              href="/contact"
              className="rounded-sm font-semibold text-slate-700 underline transition-colors hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
            >
              get in touch
            </Link>
            .
          </p>
          <p>
            <Link
              href="/login"
              className="rounded-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
            >
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    )
  }

  const errorId = error ? `${id}-error` : undefined

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm leading-relaxed text-red-900"
        >
          {error}
        </div>
      ) : null}

      <div>
        <label htmlFor={id} className="block text-sm font-semibold text-slate-900">
          Company email
        </label>
        <div className="mt-2">
          <input
            id={id}
            type="email"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}
            className={`w-full rounded-md border px-3.5 py-2.5 text-base text-slate-900 transition-colors focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-blue-700 ${
              error
                ? 'border-red-400 focus:border-red-500'
                : 'border-slate-300 focus:border-blue-700'
            }`}
          />
        </div>
        {error ? (
          <p id={errorId} className="mt-2 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-blue-700 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {pending ? 'Sending...' : 'Send reset link'}
      </button>

      <p className="text-sm leading-relaxed text-slate-500">
        Remember it?{' '}
        <Link
          href="/login"
          className="rounded-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
        >
          Sign in
        </Link>
        .
      </p>
    </form>
  )
}
