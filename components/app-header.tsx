import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Minimal chrome for signed-in pages. Deliberately not the marketing header:
 * no section nav, no Get Demo button.
 */
export function AppHeader({ right }: { right?: ReactNode }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6 lg:px-8">
        <Link
          href="/"
          className="rounded-sm text-base font-semibold tracking-tight text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
        >
          Quick Tenders
        </Link>
        {right ? <div className="text-sm text-slate-600">{right}</div> : null}
      </div>
    </header>
  )
}
