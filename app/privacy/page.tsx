import type { Metadata } from 'next'
import Link from 'next/link'

import {
  Bullets,
  ContentPage,
  DraftNotice,
  Section,
} from '@/components/content-page'

export const metadata: Metadata = {
  title: 'Privacy | Quick Tenders',
  description:
    'What Quick Tenders collects, why, where it is stored, and how one company is kept separate from another.',
}

export default function PrivacyPage() {
  return (
    <ContentPage
      eyebrow="Legal"
      title="Privacy policy"
      intro="This policy describes what Quick Tenders collects when your company uses the service, why it is collected, and what you can ask us to do with it."
      updated="26 August 2026"
      notice={
        <DraftNotice>
          This text is a working draft written to match how the product actually
          behaves. It has not been reviewed by a lawyer and it is not legal
          advice. Have counsel review it, and confirm it against the obligations
          that apply in your jurisdiction, before you rely on it in public.
        </DraftNotice>
      }
    >
      <Section heading="Who this covers">
        <p>
          It covers the representative who signs up, the company they sign up on
          behalf of, and anyone visiting this website. Quick Tenders accounts are
          company accounts: information tied to a company is available to that
          company, and to nobody else using the service.
        </p>
      </Section>

      <Section heading="What we collect">
        <Bullets
          items={[
            'Account details you give us at signup: your name, your work email address, your company name, industry, region and company size.',
            'The company domain, derived from the email address you confirm. It identifies the account and is what keeps one company separate from another.',
            'Tender activity: the tenders matched to your company, the scores and deadlines attached to them, their status, and the documents drafted for them.',
            'Technical records created by using the service: request logs, approximate location from IP address, browser and device information.',
          ]}
        />
        <p>
          We do not ask for payment card details on the free trial, and we do not
          buy personal data from third parties to enrich your account.
        </p>
      </Section>

      <Section heading="Why we collect it">
        <Bullets
          items={[
            'To run the account and let you sign in.',
            'To match tenders to your company, which is what the industry, region and size are for.',
            'To draft response documents against your company profile.',
            'To send service messages, such as a deadline approaching or a trial ending.',
            'To keep the service secure and diagnose faults.',
          ]}
        />
        <p>
          We do not use your tender activity to advertise to you, and we do not
          sell it.
        </p>
      </Section>

      <Section heading="Where it is stored">
        <p>
          Application data is held in a managed Postgres database and object
          storage operated by Supabase, our hosting provider and a processor
          acting on our instructions. Traffic to the service is encrypted in
          transit, and data at rest is encrypted by the hosting provider.
        </p>
        <p>
          Where our providers store or process data outside your own country, that
          transfer relies on the safeguards those providers have in place. If you
          need the specifics for a procurement questionnaire, ask and we will send
          the current list of processors.
        </p>
      </Section>

      <Section heading="Who can see your data">
        <p>
          Access is enforced in the database itself, not only in the application.
          Every table carries row level security policies that resolve your
          company from your signed-in identity, so one company cannot read another
          company records even if the application were asked to fetch them. The
          public, unauthenticated role has no read access to any table.
        </p>
        <p>
          Our own staff access is limited to what is needed to operate the service
          and respond to support requests. The{' '}
          <Link
            href="/security"
            className="rounded-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
          >
            security page
          </Link>{' '}
          describes the controls in more detail, including what is not yet in
          place.
        </p>
      </Section>

      <Section heading="Cookies">
        <p>
          The service sets cookies that hold your authentication session and keep
          you signed in. They are necessary for the product to work. We do not set
          advertising cookies and we do not run third-party ad trackers on this
          site.
        </p>
      </Section>

      <Section heading="How long we keep it">
        <p>
          Account and tender data is kept for as long as the company account is
          open. If a trial ends without becoming a paid plan, the account and its
          data are deleted after a reasonable retention window. Technical logs are
          kept for a shorter period for security and debugging.
        </p>
        <p>
          We may keep a minimal record of a closed account where we have to, for
          example to meet a legal or accounting obligation.
        </p>
      </Section>

      <Section heading="Your rights">
        <p>
          Depending on where you are, you can ask us to give you a copy of your
          data, correct it, export it, delete it, or restrict how we use it. You
          can also object to processing in some circumstances, and complain to your
          local data protection authority.
        </p>
        <p>
          Send requests to the privacy address below. We will ask you to confirm
          you control the company domain on the account before acting on a request
          that affects company data.
        </p>
      </Section>

      <Section heading="Changes to this policy">
        <p>
          If this policy changes in a way that affects you, we will update the date
          at the top and tell account holders by email before the change takes
          effect.
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          Privacy questions and data requests go to{' '}
          <a
            href="mailto:privacy@quicktenders.example"
            className="rounded-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
          >
            privacy@quicktenders.example
          </a>
          . Other routes are on the{' '}
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
