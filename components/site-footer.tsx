import Link from 'next/link'

import { CopyrightYear } from '@/components/copyright-year'

const footerGroups = [
  {
    heading: 'Product',
    links: [
      { label: 'How it works', href: '/#how-it-works' },
      { label: 'Why Quick Tenders', href: '/#why' },
      { label: 'Free trial', href: '/#trial' },
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
      <div className="mx-auto max-w-6xl px-6 py-16 lg:px-8">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-base font-semibold tracking-tight text-slate-900">
              Quick Tenders
            </p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-600">
              An AI agent that finds matching tenders and drafts the bids, so one
              representative can cover the whole pipeline.
            </p>
          </div>

          {footerGroups.map((group) => (
            <div key={group.heading}>
              <h2 className="text-sm font-semibold text-slate-900">{group.heading}</h2>
              <ul className="mt-4 space-y-3">
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

        <div className="mt-14 flex flex-col gap-3 border-t border-slate-200 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            &copy; <CopyrightYear initialYear={new Date().getFullYear()} /> Quick
            Tenders. All rights reserved.
          </p>
          <p className="text-sm text-slate-500">
            Drafts are a starting point. Always review before you submit.
          </p>
        </div>
      </div>
    </footer>
  )
}
