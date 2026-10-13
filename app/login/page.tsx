import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { SIGN_IN_REASONS } from '@/lib/signin'
import { createClient } from '@/lib/supabase/server'
import { safeRelativePath } from '@/lib/url'
import { SiteHeader } from '@/components/site-header'
import { PageShell } from '@/components/ui'

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

  const next = safeRelativePath(rawNext, '/dashboard')

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) redirect(next)

  const message = rawReason ? SIGN_IN_REASONS[rawReason] : undefined

  return (
    <PageShell>
      <SiteHeader />

      <main className="page-shell-main auth-layout">
        <div className="auth-form-column">
          <Link href="/" className="form-link">Back to home</Link>
          <h1 className="page-title">Sign in</h1>
          <p className="page-intro">
            Use the company email address your account was registered with.
          </p>

          <div className="mt-10">
            <LoginForm next={next} initialMessage={message} />
          </div>

          <p className="auth-copy forgot-link">
            Forgot your password?{' '}
            <Link
              href="/login/forgot-password"
              className="form-link"
            >
              Reset it here
            </Link>
            .
          </p>
        </div>

        <aside className="auth-aside">
            <h2>
              One account per company
            </h2>
            <p>
              Accounts are keyed on your email domain, so there is one per company
              rather than one per person. If a colleague set yours up, ask them for
              access rather than signing up again.
            </p>
            <p>
              Signing up needs a company email address. Consumer providers are not
              accepted.
            </p>
        </aside>
      </main>
    </PageShell>
  )
}
