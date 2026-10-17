import Link from 'next/link'

const navigation = [
  { label: 'Overview', href: '/dashboard' },
  { label: 'New tenders', href: '/dashboard?status=new' },
  { label: 'Reviewed', href: '/dashboard?status=reviewed' },
  { label: 'Submitted', href: '/dashboard?status=submitted' },
  { label: 'Expired', href: '/dashboard?status=expired' },
  { label: 'Automation', href: '/dashboard#automation' },
  { label: 'Schedule', href: '/dashboard#schedule' },
  { label: 'Subscription', href: '/upgrade' },
  { label: 'Support', href: '/contact' },
]

function NavigationLinks() {
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
          <NavigationLinks />
        </nav>
      </aside>

      <nav
        aria-label="Dashboard navigation"
        className="overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 md:hidden"
      >
        <div className="flex min-w-max gap-1">
          <NavigationLinks />
        </div>
      </nav>
    </>
  )
}
