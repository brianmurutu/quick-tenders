'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { markTenderReviewed, markTenderSubmitted } from './actions'

/**
 * Marks a tender reviewed once its page has actually been viewed.
 *
 * Why a client effect rather than doing it during the server render: a Server
 * Component render is not a user action. Next may render a route for a link
 * prefetch, and a Server Component is expected to be free of side effects, so
 * writing to the database in one would mean a tender could flip to reviewed
 * because somebody hovered a link in the list. Firing on mount ties the write to
 * a real view, which is what "opened it" is supposed to mean.
 *
 * Renders nothing.
 */
export function MarkReviewedOnView({
  tenderId,
  currentStatus,
}: {
  tenderId: string
  currentStatus: string
}) {
  const router = useRouter()
  const fired = useRef(false)

  useEffect(() => {
    // Only new tenders move, and only once per mount. The ref guards against
    // the double invocation of effects in development strict mode.
    if (currentStatus !== 'new' || fired.current) return

    fired.current = true

    void markTenderReviewed(tenderId).then((result) => {
      // Pull the new badge and the updated tab counts. A failure is deliberately
      // silent: the page is readable either way, and the next open retries.
      if (result.ok) router.refresh()
    })
  }, [tenderId, currentStatus, router])

  return null
}

export function MarkSubmittedButton({
  tenderId,
  alreadySubmitted,
}: {
  tenderId: string
  alreadySubmitted: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const [done, setDone] = useState(alreadySubmitted)

  if (done) {
    return (
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-5">
        <p className="text-sm font-semibold text-emerald-900">Marked as submitted</p>
        <p className="mt-1.5 text-sm leading-relaxed text-emerald-800">
          This tender is recorded as submitted. Quick Tenders does not lodge bids
          for you, so make sure it reached the procuring entity by their own
          channel too.
        </p>
      </div>
    )
  }

  async function onClick() {
    setError(undefined)
    setPending(true)

    try {
      const result = await markTenderSubmitted(tenderId)

      if (!result.ok) {
        setError(result.error)
        setPending(false)
        return
      }

      setDone(true)
      setPending(false)
      router.refresh()
    } catch {
      setError('That did not save. Try again in a moment.')
      setPending(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="w-full rounded-md bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {pending ? 'Saving...' : 'Mark as submitted'}
      </button>

      {error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  )
}
