import type { Metadata } from 'next'
import Link from 'next/link'

import { SiteHeader } from '@/components/site-header'
import { Card, PageShell } from '@/components/ui'
import { CALLBACK_ERRORS } from '@/lib/signup'
import { noIndexMetadata } from '@/lib/seo'

import { SignupForm } from './signup-form'

export const metadata: Metadata = {
  ...noIndexMetadata,
  title: 'Get Demo',
  description:
    'Start a 3-day Quick Tenders trial with a company email or Google account.',
}

const steps = [
  'Confirm your company email or continue with Google to create your workspace.',
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
            Create a workspace with your company email or a personal Google account.
            Tell us what you bid on and the agent starts matching.
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
              Company email or Google
            </h2>
            <p>
              Company email signups are grouped by company domain. Personal
              Google accounts get their own workspace, so you can start without
              a company-domain email.
            </p>
          </Card>
        </aside>
      </main>
    </PageShell>
  )
}
