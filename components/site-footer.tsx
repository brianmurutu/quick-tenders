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
    <footer className="site-footer">
      <div className={container}>
        <div className="site-footer-grid">
          <div>
            <Logo />
            <p className="footer-description">
              Find public tenders across Kenya and prepare bid packs for your
              representative to review and sign.
            </p>
          </div>

          {footerGroups.map((group) => (
            <div key={group.heading}>
              <h2>{group.heading}</h2>
              <ul>
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="footer-bottom">
          <div className="footer-credits">
            <p>
              &copy; <CopyrightYear initialYear={new Date().getFullYear()} /> Quick
              Tenders Kenya. All rights reserved.
            </p>
            <p>
              A project by{' '}
              <a
                href="https://starlettechnogies.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                Starlet Technologies
              </a>
              .
            </p>
          </div>
          <p>
            Drafts are for review and are not legal or procurement advice.
            Check each tender against its requirements and applicable PPADA
            rules before submission. Your representative is responsible for the
            final bid and signature.
          </p>
        </div>
      </div>
    </footer>
  )
}
