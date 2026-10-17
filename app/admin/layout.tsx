import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import Link from 'next/link'

import { Logo, LogoMark } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { signOutAction } from '@/lib/auth-actions'
import { isAdminUser } from '@/lib/admin-auth'
import { createClient } from '@/lib/supabase/server'
import { noIndexMetadata } from '@/lib/seo'

import { AdminNav } from './_components/admin-nav'

/**
 * Never prerender /admin: it is per-user gated data.
 */
export const dynamic = 'force-dynamic'

export const metadata = noIndexMetadata

/**
 * Admin section layout.
 *
 * Security model
 * ──────────────
 * The RLS policies added in 0008 are the real security boundary. An admin's
 * Supabase session (anon key + cookie) is subject to the `is_admin()` check
 * inside every `_select_admin` policy, so a non-admin session is refused at
 * the database level regardless of what this layout does.
 *
 * This layout is a convenience layer that serves a 404 to anyone who is not
 * an admin. A 404 – not a redirect – is deliberate: a redirect to /login
 * would confirm that /admin exists to a probing non-admin.
 *
 * How the check works
 * ───────────────────
 * 1. `getUser()` verifies the JWT with Supabase Auth. If there is no session,
 *    notFound() is called immediately.
 * 2. We query `admin_users` as the signed-in user. The RLS policy on that
 *    table (admin_users_select_admin) only returns a row if `is_admin()` is
 *    true. If the query returns no rows, this user is not an admin and we
 *    return 404. We do NOT call `is_admin()` as a stand-alone RPC because that
 *    would add an extra round trip; the admin_users select already exercises
 *    the same SECURITY DEFINER function under the hood.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = createClient()

  // Step 1: verify there is a valid session.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    notFound()
  }

  // Step 2: check the admin_users table. RLS returns a row iff is_admin().
  if (!(await isAdminUser(supabase, user.id))) {
    notFound()
  }

  const email = user.email ?? 'Administrator'
  const initials = email.slice(0, 1).toUpperCase()

  return (
    <div className="admin-shell min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200 bg-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] md:flex">
        <div className="border-b border-slate-200 px-6 py-5">
          <Link
            href="/admin"
            className="inline-flex rounded-sm outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest"
          >
            <Logo />
          </Link>
          <p className="mt-1 pl-10 text-xs font-medium text-slate-500">Admin workspace</p>
        </div>

        <div className="px-4 py-6">
          <p className="mb-3 px-3 text-xs font-semibold uppercase text-slate-500">
            Workspace
          </p>
          <AdminNav />
        </div>

        <div className="mt-auto border-t border-slate-200 p-4">
          <p className="text-xs leading-relaxed text-slate-500">
            Tender pipeline, company accounts, and platform health.
          </p>
        </div>
      </aside>

      <div className="min-w-0 md:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 pt-[env(safe-area-inset-top)]">
          <div className="mx-auto flex min-h-16 max-w-screen-2xl items-center gap-3 px-4 sm:px-6 lg:px-8">
            <details className="group relative shrink-0 md:hidden">
              <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-md border border-slate-200 text-slate-700 outline-offset-2 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest">
                <span className="sr-only">Open admin navigation</span>
                <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </summary>
              <div className="absolute left-0 top-12 z-40 w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                <AdminNav />
              </div>
            </details>

            <Link
              href="/admin"
              className="shrink-0 rounded-sm outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest md:hidden"
              aria-label="Quick Tenders admin overview"
            >
              <LogoMark className="size-8" />
            </Link>

            <form
              action="/admin/companies"
              method="get"
              role="search"
              className="ml-auto flex min-w-0 max-w-xl flex-1 items-center"
            >
              <label htmlFor="admin-global-search" className="sr-only">
                Search companies
              </label>
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 focus-within:border-forest focus-within:ring-1 focus-within:ring-forest">
                <svg aria-hidden="true" className="size-4 shrink-0 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-4-4" />
                </svg>
                <input
                  id="admin-global-search"
                  name="q"
                  type="search"
                  placeholder="Search companies"
                  className="min-h-10 w-full min-w-0 border-0 bg-transparent p-0 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:ring-0"
                />
                <kbd className="hidden shrink-0 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-500 lg:inline">
                  Enter
                </kbd>
              </div>
            </form>

            <ThemeToggle />

            <details className="group relative shrink-0">
              <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-md px-1.5 text-left outline-offset-2 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest">
                <span className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-900">
                  {initials}
                </span>
                <span className="hidden max-w-48 truncate text-sm font-medium text-slate-700 lg:block">
                  {email}
                </span>
                <svg aria-hidden="true" className="hidden size-4 text-slate-500 lg:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="m7 10 5 5 5-5" />
                </svg>
              </summary>
              <div className="absolute right-0 top-12 z-40 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                <p className="truncate px-3 py-2 text-sm font-medium text-slate-700">
                  {email}
                </p>
                <div className="my-1 border-t border-slate-200" />
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="flex min-h-10 w-full items-center rounded-md px-3 text-left text-sm font-medium text-slate-700 outline-offset-2 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </details>
          </div>
        </header>

        <main className="admin-main mx-auto w-full max-w-screen-2xl p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
