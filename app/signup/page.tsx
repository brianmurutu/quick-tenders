import type { Metadata } from 'next'
import Link from 'next/link'

import { CALLBACK_ERRORS } from '@/lib/signup'

import { SignupForm } from './signup-form'

export const metadata: Metadata = {
  title: 'Get Demo | Quick Tenders',
  description:
    'Start a 3-day Quick Tenders trial with your company email. One account per company.',
}

const steps = [
  'Confirm your company email. That address is what ties the account to your company.',
  'The agent starts matching tenders against the profile you give us here.',
  'Matches arrive with a drafted response pack and the deadline attached.',
  'You proofread, change what you want, and submit.',
]

export default function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const errorCode = searchParams.error
  const initialError = errorCode
    ? (CALLBACK_ERRORS[errorCode] ??
      'Something went wrong confirming your email. Try signing up again.')
    : undefined

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Deliberately lighter chrome than the marketing pages: no nav to click away with. */}
      <header className="border-b border-slate-200">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 lg:px-8">
          <Link
            href="/"
            className="rounded-sm text-base font-semibold tracking-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
          >
            Quick Tenders
          </Link>
          <div className="flex items-center gap-5">
            <Link
              href="/login"
              className="rounded-sm text-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
            >
              Sign in
            </Link>
            <Link
              href="/"
              className="rounded-sm text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
            >
              Back to home
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-14 px-6 py-16 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-20 lg:px-8">
        <div className="max-w-xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Start your 3-day trial
          </h1>
          <p className="mt-4 leading-relaxed text-slate-600">
            One account per company, set up with your company email. Tell us what
            you bid on and the agent starts matching.
          </p>

          <div className="mt-10">
            <SignupForm initialError={initialError} />
          </div>
        </div>

        <aside className="lg:pt-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-blue-700">
              What happens next
            </h2>
            <ol className="mt-5 space-y-4">
              {steps.map((step, index) => (
                <li key={step} className="flex gap-3.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-700 text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  <span className="text-sm leading-relaxed text-slate-600">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-900">
              One account per company
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
              Accounts are keyed on your email domain, so a company cannot end up
              with two. If a colleague has already signed up, ask them for access
              rather than starting again.
            </p>
          </div>
        </aside>
      </main>
    </div>
  )
}
