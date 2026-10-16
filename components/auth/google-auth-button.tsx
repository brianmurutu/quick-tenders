'use client'

import { useState } from 'react'

import { startGoogleAuth } from '@/app/login/actions'

export function GoogleAuthButton({
  flow,
  next,
  captchaToken,
  resetCaptcha,
}: {
  flow: 'signup' | 'signin'
  next?: string
  captchaToken: string | null
  resetCaptcha: () => void
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const captchaRequired =
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim())

  async function handleGoogleAuth() {
    setPending(true)
    setError(undefined)

    try {
      const result = await startGoogleAuth(flow, next, captchaToken ?? undefined)
      if (result.status === 'error') {
        setError(result.message)
        resetCaptcha()
        setPending(false)
        return
      }

      window.location.assign(result.url)
    } catch {
      setError('Google sign-in could not start. Please try again in a moment.')
      resetCaptcha()
      setPending(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleGoogleAuth}
        disabled={pending || (captchaRequired && !captchaToken)}
        className="w-full rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending
          ? 'Connecting to Google...'
          : flow === 'signup'
            ? 'Continue with Google'
            : 'Sign in with Google'}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  )
}
