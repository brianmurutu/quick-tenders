'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_LINKS = [
  { href: '/admin', label: 'Dashboard', exact: true },
  { href: '/admin/companies', label: 'Companies', exact: false },
] as const

/**
 * Sidebar navigation rendered inside the admin shell layout.
 *
 * Client Component only because usePathname is needed to mark the active link.
 * The layout that wraps it is a Server Component; this component does no
 * data-fetching of its own.
 */
export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Admin navigation">
      <ul className="space-y-1">
        {NAV_LINKS.map(({ href, label, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href)

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                  isActive
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
