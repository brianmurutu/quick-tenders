import type { Metadata } from 'next'
import Link from 'next/link'

import {
  Bullets,
  ContentPage,
  DraftNotice,
  Section,
} from '@/components/content-page'

export const metadata: Metadata = {
  title: 'Terms | Quick Tenders',
  description:
    'The terms on which companies use Quick Tenders, including the free trial and what drafted documents are and are not.',
}

export default function TermsPage() {
  return (
    <ContentPage
      eyebrow="Legal"
      title="Terms of service"
      intro="These terms cover the use of Quick Tenders by a company and by the representative who signs up on its behalf."
      updated="26 August 2026"
      notice={
        <DraftNotice>
          This text is a working draft written to match how the product actually
          behaves. It has not been reviewed by a lawyer and it is not legal
          advice. The liability, governing law and fee sections in particular need
          counsel and your own commercial decisions before this can be published.
        </DraftNotice>
      }
    >
      <Section heading="Who can use the service">
        <p>
          Quick Tenders is for companies bidding on tenders, and an account is
          registered to a company rather than to an individual. To sign up you
          need a company email address, and by signing up you confirm you are
          authorised to accept these terms for that company.
        </p>
        <p>
          One company gets one account, identified by its email domain. Addresses
          from consumer and disposable email providers cannot be used to register,
          because a shared provider domain does not identify a company.
        </p>
      </Section>

      <Section heading="The free trial">
        <p>
          A new account starts with a free trial lasting three days from the moment
          it is created. The trial is per company, not per person, so a second
          person from the same company cannot start a fresh trial on the same
          domain.
        </p>
        <p>
          When the trial ends, access to matching and drafting stops unless the
          account moves onto a paid plan. We will tell you before that happens.
        </p>
      </Section>

      <Section heading="Drafts, and what you are responsible for">
        <p>
          The service produces drafts. A drafted technical proposal, pricing
          schedule or compliance document is a starting point prepared
          automatically, and it may be incomplete, out of date or wrong.
        </p>
        <p>You are responsible for:</p>
        <Bullets
          items={[
            'Reading every document before it is submitted anywhere.',
            'The accuracy of anything you submit, including any figure, claim or certification carried over from a draft.',
            'Meeting the actual requirements, format and deadline of the tender you are bidding on.',
            'Deciding whether to bid at all.',
          ]}
        />
        <p>
          Nothing the service produces is legal, financial or professional advice,
          and using it does not make us a party to any bid you submit.
        </p>
      </Section>

      <Section heading="What we do not promise">
        <Bullets
          items={[
            'That every tender relevant to your company will be found. Coverage depends on the sources available and on what your profile says about you.',
            'That a match score reflects your actual chance of winning.',
            'That a drafted document meets the requirements of the tender it was drafted for.',
            'That the service will be uninterrupted or error free.',
          ]}
        />
        <p>
          The service is provided as it is, without warranties beyond those that
          cannot lawfully be excluded.
        </p>
      </Section>

      <Section heading="Acceptable use">
        <p>You agree not to:</p>
        <Bullets
          items={[
            'Register a domain you do not control, or misrepresent the company you are acting for.',
            'Share one account across separate companies, or resell access.',
            'Attempt to reach data belonging to another company, or probe the service for weaknesses outside the disclosure process on the security page.',
            'Scrape or bulk export the service beyond your own company data.',
          ]}
        />
      </Section>

      <Section heading="Fees and plans">
        <p>
          Paid plan pricing and billing terms are set out at the point you move
          off the trial, and they form part of these terms once accepted. Fees are
          payable in advance unless agreed otherwise in writing.
        </p>
      </Section>

      <Section heading="Suspension and termination">
        <p>
          You can stop using the service and ask for your account to be closed at
          any time. We can suspend or close an account that breaches these terms,
          that puts the service or other customers at risk, or where fees go
          unpaid, and we will give notice where it is reasonable to do so.
        </p>
        <p>
          On closure, your company data is deleted in line with the{' '}
          <Link
            href="/privacy"
            className="rounded-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
          >
            privacy policy
          </Link>
          .
        </p>
      </Section>

      <Section heading="Liability">
        <p>
          To the extent the law allows, we are not liable for lost profits, lost
          contracts, lost bids, or indirect and consequential losses arising from
          use of the service. Nothing here limits liability that cannot lawfully be
          limited.
        </p>
      </Section>

      <Section heading="Changes to these terms">
        <p>
          We may change these terms as the product changes. If a change materially
          affects you we will tell account holders by email before it takes effect,
          and the date at the top of this page will be updated.
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          Questions about these terms go to{' '}
          <a
            href="mailto:legal@quicktenders.ke"
            className="rounded-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
          >
            legal@quicktenders.ke
          </a>
          .
        </p>
      </Section>
    </ContentPage>
  )
}
