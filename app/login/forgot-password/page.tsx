import type { Metadata } from 'next'
import Link from 'next/link'

import { ForgotPasswordForm } from './forgot-password-form'

export const metadata: Metadata = {
  title: 'Reset password | Quick Tenders',
  description: 'Request a password reset link for your Quick Tenders account.',
}

export default function ForgotPasswordPage() {
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
          <Link
            href="/login"
            className="rounded-sm text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
          >
            Back to sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-md px-6 py-16 lg:px-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Reset password</h1>
        <p className="mt-4 leading-relaxed text-slate-600">
          Enter the email address on your account and we will send a reset link. It expires
          in one hour.
        </p>

        <div className="mt-10">
          <ForgotPasswordForm />
        </div>
      </main>
    </div>
  )
}
