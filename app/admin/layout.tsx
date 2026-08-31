import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import { Logo } from '@/components/logo'
import { signOutAction } from '@/lib/auth-actions'
import { createClient } from '@/lib/supabase/server'

import { AdminNav } from './_components/admin-nav'

/**
 * Never prerender /admin: it is per-user gated data.
 */
export const dynamic = 'force-dynamic'

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
  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (!adminRow) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top bar */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="select-none text-xs font-semibold uppercase tracking-widest text-slate-400">
              Admin
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-500">{user.email}</span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-sm font-medium text-slate-600 transition-colors hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div className="mx-auto flex max-w-7xl gap-8 px-6 py-8 lg:px-8">
        {/* Sidebar */}
        <aside className="w-44 shrink-0">
          <AdminNav />
        </aside>

        {/* Main content area */}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
