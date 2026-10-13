import Link from 'next/link'

import { container } from '@/components/layout'
import { Logo } from '@/components/logo'

/**
 * Section links are absolute (/#how-it-works) rather than bare fragments, so
 * the header works the same on every page and not only on the home page.
 */
const navLinks = [
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Why Quick Tenders', href: '/#why' },
  { label: 'Pricing', href: '/#pricing' },
]

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className={`${container} site-header-inner`}>
        <Link
          href="/"
          className="rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
          aria-label="Quick Tenders home"
        >
          <Logo variant="inverse" />
        </Link>

        <nav aria-label="Main">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="site-header-actions">
          <Link
            href="/login"
            className="sign-in-link rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
          >
            Sign in
          </Link>

          <Link
            href="/signup"
            className="header-cta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            Get Demo
          </Link>
        </div>
      </div>
    </header>
  )
}
