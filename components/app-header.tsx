import Link from 'next/link'
import type { ReactNode } from 'react'

import { Logo } from '@/components/logo'
import { signOutAction } from '@/lib/auth-actions'

/**
 * Minimal chrome for signed-in pages. Deliberately not the marketing header:
 * no section nav, no Get Demo button.
 *
 * Sign out is a form posting to a Server Action, so it works without JavaScript
 * and gets Server Action origin checking rather than being an endpoint any
 * cross-site form could hit.
 */
export function AppHeader({
  right,
  showSignOut = true,
}: {
  right?: ReactNode
  showSignOut?: boolean
}) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-6 lg:px-8">
        <Link
          href="/"
          className="rounded-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
        >
          <Logo />
        </Link>

        <div className="flex items-center gap-5 text-sm">
          {right ? <div className="text-slate-600">{right}</div> : null}

          {showSignOut ? (
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-sm font-medium text-slate-600 transition-colors hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
              >
                Sign out
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </header>
  )
}
