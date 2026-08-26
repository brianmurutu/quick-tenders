import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { SIGN_IN_REASONS } from '@/lib/signin'
import { createClient } from '@/lib/supabase/server'
import { safeRelativePath } from '@/lib/url'

import { LoginForm } from './login-form'

export const metadata: Metadata = {
  title: 'Sign in | Quick Tenders',
  description: 'Sign in to Quick Tenders to see your matched tenders.',
}

/** Reads the session to bounce an already-signed-in visitor. Never prerendered. */
export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string | string[]; reason?: string | string[] }
}) {
  const rawNext = Array.isArray(searchParams.next) ? searchParams.next[0] : searchParams.next
  const rawReason = Array.isArray(searchParams.reason)
    ? searchParams.reason[0]
    : searchParams.reason

  // Validated here as well as in the action, so the value put on the form is
  // already safe and a crafted ?next= cannot turn this page into a redirector.
  const next = safeRelativePath(rawNext, '/dashboard')

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Somebody already signed in has no business on this page. Sending them on is
  // better than showing a form that would just log them in again.
  if (user) redirect(next)

  const message = rawReason ? SIGN_IN_REASONS[rawReason] : undefined

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Same reduced chrome as signup: nothing to click away with. */}
      <header className="border-b border-slate-200">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 lg:px-8">
          <Link
            href="/"
            className="rounded-sm text-base font-semibold tracking-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
          >
            Quick Tenders
          </Link>
          <Link
            href="/"
            className="rounded-sm text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
          >
            Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-14 px-6 py-16 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-20 lg:px-8">
        <div className="max-w-md">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Sign in</h1>
          <p className="mt-4 leading-relaxed text-slate-600">
            Use the company email address your account was registered with.
          </p>

          <div className="mt-10">
            <LoginForm next={next} initialMessage={message} />
          </div>

          <p className="mt-8 border-t border-slate-200 pt-6 text-sm leading-relaxed text-slate-500">
            Locked out? Password reset is not built yet, so{' '}
            <Link
              href="/contact"
              className="rounded-sm font-semibold text-slate-700 underline transition-colors hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
            >
              get in touch
            </Link>{' '}
            and we will sort it out by hand.
          </p>
        </div>

        <aside className="lg:pt-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-blue-700">
              One account per company
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              Accounts are keyed on your email domain, so there is one per company
              rather than one per person. If a colleague set yours up, ask them for
              access rather than signing up again.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              Signing up needs a company email address. Consumer providers are not
              accepted.
            </p>
          </div>
        </aside>
      </main>
    </div>
  )
}
