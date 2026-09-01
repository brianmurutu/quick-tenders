'use client'

import { useState, useTransition } from 'react'
import { resendAuthEmailAction, type ResendAuthResult } from '../auth-actions'

export function AdminResendAuthCard({ initialEmail = '' }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail)
  const [result, setResult] = useState<ResendAuthResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setResult(null)
    setCopied(false)

    startTransition(async () => {
      const res = await resendAuthEmailAction(email)
      setResult(res)
    })
  }

  function handleCopy() {
    if (!result?.actionLink) return
    void navigator.clipboard.writeText(result.actionLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Auth & Signup Recovery
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Resend signup confirmation emails or generate instant verification links for users with redirect issues.
          </p>
        </div>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
          Admin Tool
        </span>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[260px]">
          <label htmlFor="user-email" className="sr-only">
            User Email Address
          </label>
          <input
            id="user-email"
            type="email"
            placeholder="e.g. brian@mylife.mku.ac.ke"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          {isPending ? 'Processing…' : 'Resend Auth Email'}
        </button>
      </form>

      {result && (
        <div
          className={`mt-4 rounded-lg p-4 text-sm ${
            result.ok
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border border-red-200 bg-red-50 text-red-900'
          }`}
        >
          <p className="font-medium">{result.message}</p>

          {result.actionLink && (
            <div className="mt-3">
              <p className="text-xs text-emerald-700 mb-1 font-semibold">
                Direct Confirmation Link (Ready to copy & send to user):
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={result.actionLink}
                  className="flex-1 rounded border border-emerald-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none select-all font-mono"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="shrink-0 rounded bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 focus:outline-none"
                >
                  {copied ? '✓ Copied' : 'Copy Link'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
