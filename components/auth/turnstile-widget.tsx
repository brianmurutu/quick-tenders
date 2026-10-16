'use client'

import { useEffect, useRef } from 'react'

type TurnstileApi = {
  render(
    container: HTMLElement,
    options: {
      sitekey: string
      action: string
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => void
      theme?: 'auto' | 'light' | 'dark'
    },
  ): string
  remove(widgetId: string): void
  reset(widgetId: string): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
    turnstileLoadPromise?: Promise<TurnstileApi>
  }
}

const SCRIPT_ID = 'cloudflare-turnstile-script'
const SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (window.turnstileLoadPromise) return window.turnstileLoadPromise

  window.turnstileLoadPromise = new Promise((resolve, reject) => {
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null

    if (!script) {
      script = document.createElement('script')
      script.id = SCRIPT_ID
      script.src = SCRIPT_URL
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }

    const loaded = () => {
      if (window.turnstile) resolve(window.turnstile)
      else reject(new Error('Turnstile loaded without its API'))
    }

    script.addEventListener(
      'load',
      loaded,
      { once: true },
    )
    script.addEventListener(
      'error',
      () => {
        window.turnstileLoadPromise = undefined
        reject(new Error('Turnstile could not be loaded'))
      },
      { once: true },
    )
  })

  return window.turnstileLoadPromise
}

export function TurnstileWidget({
  action,
  onToken,
  resetVersion,
}: {
  action: string
  onToken: (token: string | null) => void
  resetVersion: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const onTokenRef = useRef(onToken)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()

  useEffect(() => {
    onTokenRef.current = onToken
  }, [onToken])

  useEffect(() => {
    if (!siteKey || !containerRef.current) return
    let cancelled = false
    onTokenRef.current(null)

    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return

        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
          theme: 'auto',
        })
      })
      .catch((error: unknown) => {
        console.error(
          '[turnstile] Widget failed to load:',
          error instanceof Error ? error.message : String(error),
        )
      })

    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [action, resetVersion, siteKey])

  if (!siteKey) {
    return process.env.NODE_ENV === 'production' ? (
      <p role="alert" className="text-sm text-red-700">
        Security verification is not configured. Please contact support.
      </p>
    ) : null
  }

  return <div ref={containerRef} aria-label="Security verification" />
}
