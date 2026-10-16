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
          <h1 className="page-title text-balance">Sign in</h1>
          <p className="page-intro text-pretty">
            Sign in with Google or use the email address and password linked to your account.
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

        <aside className="space-y-4">
          <div className="auth-aside">
            <h2 className="text-balance">Sign in your way</h2>
            <p className="text-pretty">
              Continue with Google or enter the email address linked to your
              Quick Tenders account. If you use Google, choose the same Google
              account you used when signing up.
            </p>
          </div>

          <div className="hidden space-y-4 lg:grid">
            <section className="rounded-md border border-slate-200 bg-white p-5">
              <h2 className="text-balance text-base font-semibold text-slate-900">
                Opportunities matched to your business
              </h2>
              <p className="mt-2 text-pretty text-sm leading-relaxed text-slate-600">
                Tender matches use your company profile, sectors, location and
                company size to help surface relevant opportunities.
              </p>
            </section>
            <section className="rounded-md border border-slate-200 bg-white p-5">
              <h2 className="text-balance text-base font-semibold text-slate-900">
                Bid drafts, ready for your review
              </h2>
              <p className="mt-2 text-pretty text-sm leading-relaxed text-slate-600">
                Review and complete the generated documents against the tender
                requirements. Your team remains responsible for the final bid.
              </p>
            </section>
            <section className="rounded-md border border-slate-200 bg-white p-5">
              <h2 className="text-balance text-base font-semibold text-slate-900">
                You stay in control
              </h2>
              <p className="mt-2 text-pretty text-sm leading-relaxed text-slate-600">
                Quick Tenders helps with discovery and drafting; it does not
                submit bids on your behalf.
              </p>
            </section>
          </div>
        </aside>
      </main>
    </PageShell>
  )
}
