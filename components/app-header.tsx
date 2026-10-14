import Link from 'next/link'
import type { ReactNode } from 'react'

import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
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
    <header className="app-header">
      <div className="app-header-inner">
        <Link
          href="/"
          className="app-header-logo"
        >
          <Logo />
        </Link>

        <div className="app-header-actions">
          {right ? <div className="app-header-context">{right}</div> : null}

          <ThemeToggle />

          {showSignOut ? (
            <form action={signOutAction}>
              <button
                type="submit"
                className="app-header-signout"
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
