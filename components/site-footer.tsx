import Link from 'next/link'

import { CopyrightYear } from '@/components/copyright-year'
import { container } from '@/components/layout'
import { Logo } from '@/components/logo'

const footerGroups = [
  {
    heading: 'Product',
    links: [
      { label: 'How it works', href: '/#how-it-works' },
      { label: 'Why Quick Tenders', href: '/#why' },
      { label: 'Pricing', href: '/#pricing' },
      { label: 'Get Demo', href: '/signup' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Careers', href: '/careers' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Security', href: '/security' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className={`${container} py-10 lg:py-12`}>
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-600">
              Kenya&apos;s AI agent for tender discovery and automated bid drafting.
              Empowering local suppliers and contractors to win more government and private contracts.
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              <span>Monitoring PPIP &amp; 47 Counties</span>
            </div>
          </div>

          {footerGroups.map((group) => (
            <div key={group.heading}>
              <h2 className="text-sm font-semibold text-slate-900">{group.heading}</h2>
              <ul className="mt-3.5 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="rounded-sm text-sm text-slate-600 transition-colors hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            &copy; <CopyrightYear initialYear={new Date().getFullYear()} /> Quick
            Tenders Kenya. All rights reserved.
          </p>
          <p className="text-xs text-slate-500">
            Drafts are a starting point. Always review against PPADA tender requirements before submission.
          </p>
        </div>
      </div>
      {/* Kenyan national ribbon accent */}
      <div className="kenya-stripe h-[3px] w-full" aria-hidden="true" />
    </footer>
  )
}
