'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const navigation = [
  { label: 'Overview', href: '/dashboard', status: null },
  { label: 'New tenders', href: '/dashboard?status=new', status: 'new' },
  { label: 'Reviewed', href: '/dashboard?status=reviewed', status: 'reviewed' },
  { label: 'Submitted', href: '/dashboard?status=submitted', status: 'submitted' },
  { label: 'Expired', href: '/dashboard?status=expired', status: 'expired' },
  { label: 'Automation', href: '/dashboard#automation', status: null },
  { label: 'Schedule', href: '/dashboard#schedule', status: null },
  { label: 'Subscription', href: '/upgrade', status: null },
  { label: 'Support', href: '/contact', status: null },
] as const

function NavigationLinks() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const status = searchParams.get('status')

  return navigation.map((item) => {
    const isActive =
      item.href === '/dashboard'
        ? pathname === '/dashboard' && (!status || status === 'all')
        : item.status
          ? pathname === '/dashboard' && status === item.status
          : false

    return (
      <Link
        key={item.label}
        href={item.href}
        aria-current={isActive ? 'page' : undefined}
        data-active={isActive}
        className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 data-[active=true]:bg-blue-50 data-[active=true]:text-blue-800 data-[active=true]:hover:bg-blue-50 data-[active=true]:hover:text-blue-800"
      >
        {item.label}
      </Link>
    )
  })
}

function NavigationFallback() {
  return navigation.map((item) => (
    <Link
      key={item.label}
      href={item.href}
      className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
    >
      {item.label}
    </Link>
  ))
}

export function DashboardNavigation({ companyName }: { companyName: string }) {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col overflow-y-auto border-r border-slate-200 bg-white px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:flex">
        <Link
          href="/dashboard"
          className="mb-8 rounded-sm px-3 text-lg font-semibold text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
        >
          Quick Tenders
        </Link>
        <p className="mb-2 truncate px-3 text-xs font-semibold uppercase text-slate-500">
          {companyName}
        </p>
        <nav aria-label="Dashboard navigation" className="flex flex-col gap-1">
          <Suspense fallback={<NavigationFallback />}>
            <NavigationLinks />
          </Suspense>
        </nav>
      </aside>

      <nav
        aria-label="Dashboard navigation"
        className="overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 md:hidden"
      >
        <div className="flex min-w-max gap-1">
          <Suspense fallback={<NavigationFallback />}>
            <NavigationLinks />
          </Suspense>
        </div>
      </nav>
    </>
  )
}
