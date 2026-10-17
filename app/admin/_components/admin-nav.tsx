'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_LINKS = [
  { href: '/admin', label: 'Overview', icon: 'overview' },
  { href: '/admin/companies', label: 'Users', icon: 'users' },
  { href: '/admin#analytics', label: 'Analytics', icon: 'analytics' },
  { href: '/admin#settings', label: 'Settings', icon: 'settings' },
  { href: '/admin#support', label: 'Support', icon: 'support' },
] as const

function NavIcon({ name }: { name: (typeof NAV_LINKS)[number]['icon'] }) {
  const iconPaths = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    analytics: <><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-5 5" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.7-1.4-2.4 1.4-1.1a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.7 1.4 2.4-1.4 1.1a8 8 0 0 1 0 2Z" transform="translate(-1 -1)" /></>,
    support: <><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></>,
  }

  return (
    <svg
      aria-hidden="true"
      className="size-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name]}
    </svg>
  )
}

export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Admin navigation">
      <ul className="grid gap-1">
        {NAV_LINKS.map(({ href, label, icon }) => {
          const targetPath = href.split('#')[0]
          const isActive =
            targetPath === '/admin'
              ? pathname === '/admin' && label === 'Overview'
              : pathname.startsWith(targetPath)

          return (
            <li key={label}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={isActive ? 'page' : undefined}
                data-active={isActive}
                className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-600 outline-offset-2 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest data-[active=true]:bg-emerald-50 data-[active=true]:text-emerald-900 data-[active=true]:hover:bg-emerald-50 data-[active=true]:hover:text-emerald-900"
              >
                <NavIcon name={icon} />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
