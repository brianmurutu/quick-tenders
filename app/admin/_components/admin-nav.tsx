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
    <nav className="admin-nav" aria-label="Admin navigation">
      <ul>
        {NAV_LINKS.map(({ href, label, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href)

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={`admin-nav-link${isActive ? ' is-active' : ''}`}
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
