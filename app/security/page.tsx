import type { Metadata } from 'next'
import Link from 'next/link'

import { Bullets, ContentPage, Section } from '@/components/content-page'

export const metadata: Metadata = {
  title: 'Security | Quick Tenders',
  description:
    'How Quick Tenders separates one company from another, how accounts are established, and what is not yet in place.',
}

export default function SecurityPage() {
  return (
    <ContentPage
      eyebrow="Security"
      title="How company data is kept apart"
      intro="Tender activity is commercially sensitive, so this page describes what is actually in place today rather than what we intend to build. The last section is the part most security pages leave out."
    >
      <Section heading="Isolation is enforced in the database">
        <p>
          Every table carries row level security policies, so the boundary between
          two companies is enforced by Postgres rather than by application code
          remembering to filter. A query that forgot its company filter returns
          nothing rather than another company data.
        </p>
        <Bullets
          items={[
            'Each policy resolves your company from your signed-in identity, not from anything the browser sends.',
            'Read and write are granted separately, per table, per operation.',
            'Documents are authorised through the tender they belong to, so a document cannot be reached without access to its parent tender.',
            'The public, unauthenticated role has no read access to any application table.',
          ]}
        />
      </Section>

      <Section heading="Accounts and sign in">
        <p>
          Authentication is handled by Supabase Auth. Signing up requires
          confirming a company email address, and the confirmation link is what
          establishes the account.
        </p>
        <Bullets
          items={[
            'One company gets one account, keyed on the email domain.',
            'Consumer and disposable email providers are rejected at signup, so a shared provider domain cannot be claimed as a company.',
            'Session tokens are held in cookies and refreshed server side on each request.',
          ]}
        />
      </Section>

      <Section heading="The company domain cannot be self-declared">
        <p>
          When an account is created, the company domain is taken from the email
          address that was actually confirmed. It is never read from a form field
          or any other client input, so a user cannot register a domain they do not
          control by editing a request.
        </p>
        <p>
          Account creation runs as a single database operation that either creates
          the company and its representative together or does neither, and a second
          attempt on an existing domain is rejected rather than quietly joining the
          existing company.
        </p>
      </Section>

      <Section heading="Storage and transport">
        <p>
          Application data lives in managed Postgres and object storage operated by
          Supabase. Traffic is served over TLS, and data at rest is encrypted by
          the hosting provider. Uploaded tender documents are stored against the
          company that owns them and are subject to the same access rules.
        </p>
      </Section>

      <Section heading="Where we are today">
        <p>
          Being straightforward about the gaps is more useful to you than a page of
          badges. As things stand:
        </p>
        <Bullets
          items={[
            'There is no third-party security certification. We do not hold SOC 2, ISO 27001 or equivalent, and we will not claim otherwise on a questionnaire.',
            'No external penetration test has been carried out yet.',
            'There is no paid bug bounty. Reports are still welcome and will be acknowledged.',
            'The product is early. Controls described above are implemented; anything not described above should be assumed not to be in place.',
          ]}
        />
        <p>
          If your procurement process needs something on this list, say so when you
          get in touch and we will tell you honestly where it stands rather than
          when it might arrive.
        </p>
      </Section>

      <Section heading="Reporting a vulnerability">
        <p>
          Send reports to{' '}
          <a
            href="mailto:security@quicktenders.co.ke"
            className="rounded-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
          >
            security@quicktenders.co.ke
          </a>{' '}
          with enough detail to reproduce the issue. We aim to acknowledge within
          three working days.
        </p>
        <p>What we ask of reporters:</p>
        <Bullets
          items={[
            'Give us a reasonable window to fix the issue before publishing it.',
            'Use only accounts and data you own for testing.',
            'No automated scanning, load testing or denial of service against the production service.',
            'Do not access, modify or retain another company data. If you reach it accidentally, stop and tell us what you saw.',
          ]}
        />
        <p>
          Other contact routes are on the{' '}
          <Link
            href="/contact"
            className="rounded-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
          >
            contact page
          </Link>
          .
        </p>
      </Section>
    </ContentPage>
  )
}
