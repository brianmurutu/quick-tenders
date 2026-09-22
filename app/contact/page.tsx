import type { Metadata } from 'next'
import Link from 'next/link'

import { ContactBlock, ContentPage, Section } from '@/components/content-page'

export const metadata: Metadata = {
  title: 'Contact | Quick Tenders',
  description: 'How to reach Quick Tenders about demos, support or security.',
}

export default function ContactPage() {
  return (
    <ContentPage
      eyebrow="Contact"
      title="Get in touch with Quick Tenders Kenya"
      intro="Pick the route that matches what you need. Including your company email domain in your message helps us locate your account and active bids immediately."
    >
      <Section heading="Sales and demos">
        <p>
          The fastest way to see the product is to start a trial, which takes a
          company email address and no setup call.
        </p>
        <p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-md bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Get Demo (3-Day Free Trial)
          </Link>
        </p>
      </Section>

      <Section heading="Reach our team">
        <div className="grid gap-4 sm:grid-cols-2">
          <ContactBlock label="Support & Helpdesk" email="support@quicktenders.co.ke">
            Questions about PPIP matches, Word proposal drafts, or your trial. Include your company
            domain so the account can be found.
          </ContactBlock>

          <ContactBlock label="Sales & Enterprise" email="sales@quicktenders.co.ke">
            Custom plans, enterprise invoicing, M-Pesa billing, and high-volume tender pipelines across multiple sectors.
          </ContactBlock>

          <ContactBlock label="Security & Compliance" email="security@quicktenders.co.ke">
            Vulnerability reports, data protection inquiries, and procurement security questionnaires.
          </ContactBlock>

          <ContactBlock label="Careers & Partnerships" email="careers@quicktenders.co.ke">
            Partnership inquiries, contractor networks, and speculative career applications.
          </ContactBlock>
        </div>
      </Section>

      <Section heading="Office & Hours">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="font-semibold text-slate-900">Headquarters</p>
              <p className="mt-1 text-slate-600">Nairobi, Kenya</p>
              <p className="mt-0.5 text-xs text-slate-500">Serving suppliers &amp; contractors across all 47 counties</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Operating Hours</p>
              <p className="mt-1 text-slate-600">Monday – Friday: 8:00 AM – 5:00 PM EAT</p>
              <p className="mt-0.5 text-xs text-slate-500">Tender crawlers &amp; automated alerts operate 24/7/365</p>
            </div>
          </div>
        </div>
      </Section>

      <Section heading="Reporting a security issue">
        <p>
          If you have found something that affects the safety of customer data,
          send it to{' '}
          <a
            href="mailto:security@quicktenders.co.ke"
            className="rounded-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
          >
            security@quicktenders.co.ke
          </a>{' '}
          rather than raising it in public. The{' '}
          <Link
            href="/security"
            className="rounded-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
          >
            security page
          </Link>{' '}
          sets out what we ask of reporters and what is in place today.
        </p>
      </Section>
    </ContentPage>
  )
}
