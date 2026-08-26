'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useId, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import { MIN_PASSWORD_LENGTH } from '@/lib/signup'

type Status = 'idle' | 'exchanging' | 'ready' | 'saving' | 'done' | 'error'

export function ResetPasswordForm() {
  const formId = useId()
  const router = useRouter()
  const [status, setStatus] = useState<Status>('idle')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({})
  const [formError, setFormError] = useState<string>()

  // On mount, exchange the code token that Supabase put in the URL hash / query.
  // Supabase's onAuthStateChange with 'PASSWORD_RECOVERY' fires when the link
  // is opened, which gives us a session before the user types anything.
  useEffect(() => {
    setStatus('exchanging')
    const supabase = createClient()

    // The PKCE code comes in as ?code=... — exchange it immediately.
    const code = new URLSearchParams(window.location.search).get('code')

    async function exchange() {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          setFormError('This reset link has expired or has already been used. Request a new one.')
          setStatus('error')
          return
        }
      }
      setStatus('ready')
    }

    exchange()
  }, [])

  function validateLocal() {
    const errors: { password?: string; confirm?: string } = {}
    if (!password) {
      errors.password = 'Enter a new password.'
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`
    }
    if (!confirm) {
      errors.confirm = 'Confirm your new password.'
    } else if (confirm !== password) {
      errors.confirm = 'The passwords do not match.'
    }
    return errors
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(undefined)

    const errors = validateLocal()
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    setStatus('saving')

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        setFormError(
          error.message.toLowerCase().includes('same password')
            ? 'The new password must be different from the old one.'
            : 'We could not update your password. Try again in a moment.',
        )
        setStatus('ready')
        return
      }

      setStatus('done')
      // Short delay so the success message is readable, then go to dashboard.
      setTimeout(() => router.replace('/dashboard'), 2000)
    } catch {
      setFormError('Something went wrong. Try again in a moment.')
      setStatus('ready')
    }
  }

  if (status === 'idle' || status === 'exchanging') {
    return (
      <p className="text-sm text-slate-500">Verifying reset link…</p>
    )
  }

  if (status === 'error') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-7">
        <h2 className="text-lg font-semibold text-red-900">Link expired</h2>
        <p className="mt-3 text-sm leading-relaxed text-red-800">
          {formError ?? 'This reset link has expired or has already been used.'}
        </p>
        <p className="mt-4 text-sm">
          <a
            href="/login/forgot-password"
            className="rounded-sm font-semibold text-red-900 underline hover:text-red-700"
          >
            Request a new reset link
          </a>
        </p>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-7">
        <h2 className="text-lg font-semibold text-emerald-900">Password updated</h2>
        <p className="mt-3 text-sm leading-relaxed text-emerald-800">
          Your password has been changed. Taking you to the dashboard now.
        </p>
      </div>
    )
  }

  const controlClasses =
    'w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 transition-colors focus:border-blue-700 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-blue-700'
  const errorControlClasses =
    'w-full rounded-md border border-red-400 bg-white px-3.5 py-2.5 text-base text-slate-900 transition-colors focus:border-red-500 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-red-500'

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

      <div>
        <label htmlFor={`${formId}-password`} className="block text-sm font-semibold text-slate-900">
          New password
        </label>
        <div className="mt-2">
          <input
            id={`${formId}-password`}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }))
            }}
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={fieldErrors.password ? `${formId}-password-error` : undefined}
            className={fieldErrors.password ? errorControlClasses : controlClasses}
          />
        </div>
        {fieldErrors.password ? (
          <p id={`${formId}-password-error`} className="mt-2 text-sm font-medium text-red-700">
            {fieldErrors.password}
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-500">At least {MIN_PASSWORD_LENGTH} characters.</p>
        )}
      </div>

      <div>
        <label htmlFor={`${formId}-confirm`} className="block text-sm font-semibold text-slate-900">
          Confirm new password
        </label>
        <div className="mt-2">
          <input
            id={`${formId}-confirm`}
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value)
              if (fieldErrors.confirm) setFieldErrors((prev) => ({ ...prev, confirm: undefined }))
            }}
            aria-invalid={fieldErrors.confirm ? true : undefined}
            aria-describedby={fieldErrors.confirm ? `${formId}-confirm-error` : undefined}
            className={fieldErrors.confirm ? errorControlClasses : controlClasses}
          />
        </div>
        {fieldErrors.confirm ? (
          <p id={`${formId}-confirm-error`} className="mt-2 text-sm font-medium text-red-700">
            {fieldErrors.confirm}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={status === 'saving'}
        className="w-full rounded-md bg-blue-700 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {status === 'saving' ? 'Saving…' : 'Set new password'}
      </button>
    </form>
  )
}
