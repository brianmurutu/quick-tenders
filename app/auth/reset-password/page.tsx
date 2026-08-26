import type { Metadata } from 'next'
import Link from 'next/link'

import { ResetPasswordForm } from './reset-form'

export const metadata: Metadata = {
  title: 'Set new password | Quick Tenders',
  description: 'Set a new password for your Quick Tenders account.',
}

/**
 * Where Supabase's "reset password" email links land.
 *
 * The link contains a ?code= token. Supabase's JS client exchanges it for a
 * session, then the form calls supabase.auth.updateUser({ password }) while
 * that session is active.
 *
 * This page is always dynamic — it reads auth state.
 */
export const dynamic = 'force-dynamic'

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 lg:px-8">
          <Link
            href="/"
            className="rounded-sm text-base font-semibold tracking-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
          >
            Quick Tenders
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-md px-6 py-16 lg:px-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Set new password</h1>
        <p className="mt-4 leading-relaxed text-slate-600">
          Choose a strong password with at least 10 characters.
        </p>

        <div className="mt-10">
          <ResetPasswordForm />
        </div>
      </main>
    </div>
  )
}
