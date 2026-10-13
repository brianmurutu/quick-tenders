import type { Metadata } from 'next'
import Link from 'next/link'

import { SiteHeader } from '@/components/site-header'
import { Card, PageShell } from '@/components/ui'
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
    <PageShell>
      <SiteHeader />

      <main className="page-shell-main auth-layout">
        <div className="auth-form-column">
          <Link href="/" className="form-link">Back to home</Link>
          <h1 className="page-title">
            Start your 3-day trial
          </h1>
          <p className="page-intro">
            One account per company, set up with your company email. Tell us what
            you bid on and the agent starts matching.
          </p>

          <div className="mt-10">
            <SignupForm initialError={initialError} />
          </div>
        </div>

        <aside className="auth-aside">
            <h2>
              What happens next
            </h2>
            <ol>
              {steps.map((step, index) => (
                <li key={step} className="flex gap-3.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-700 text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  <span>
                    {step}
                  </span>
                </li>
              ))}
            </ol>

          <Card className="auth-aside auth-company-note">
            <h2>
              One account per company
            </h2>
            <p>
              Accounts are keyed on your email domain, so a company cannot end up
              with two. If a colleague has already signed up, ask them for access
              rather than starting again.
            </p>
          </Card>
        </aside>
      </main>
    </PageShell>
  )
}
