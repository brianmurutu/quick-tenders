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
      title="Get in touch"
      intro="Pick the route that matches what you need. Including your company email domain in the first message saves a round trip, because that is how accounts are identified."
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
            Get Demo
          </Link>
        </p>
      </Section>

      <Section heading="Reach a person">
        <div className="grid gap-4 sm:grid-cols-2">
          <ContactBlock label="Support" email="support@quicktenders.example">
            Questions about matches, drafts or your trial. Include your company
            domain so the account can be found.
          </ContactBlock>

          <ContactBlock label="Sales" email="sales@quicktenders.example">
            Plans, invoicing, and anything about running Quick Tenders across a
            larger bidding operation.
          </ContactBlock>

          <ContactBlock label="Security" email="security@quicktenders.example">
            Vulnerability reports and security questionnaires. Please read the
            disclosure note first.
          </ContactBlock>

          <ContactBlock label="Careers" email="careers@quicktenders.example">
            Speculative applications are welcome even when no roles are listed.
          </ContactBlock>
        </div>
      </Section>

      <Section heading="Reporting a security issue">
        <p>
          If you have found something that affects the safety of customer data,
          send it to the security address above rather than raising it in public.
          The{' '}
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
