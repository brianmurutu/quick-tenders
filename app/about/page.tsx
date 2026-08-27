import type { Metadata } from 'next'
import Link from 'next/link'

import { Bullets, ContentPage, Section } from '@/components/content-page'

export const metadata: Metadata = {
  title: 'About | Quick Tenders',
  description:
    'Why Quick Tenders exists: tenders close on fixed dates, and the response pack is the reason good opportunities go unanswered.',
}

export default function AboutPage() {
  return (
    <ContentPage
      eyebrow="About"
      title="Built for the companies doing the bidding"
      intro="The hard part of tendering is rarely the work itself. It is finding the tender while there is still time to respond, then finding the days to write the response."
    >
      <Section heading="The problem we started from">
        <p>
          Tenders are published across many portals on their own schedules, and
          every one of them closes on a fixed date. A company that checks portals
          once a week will keep missing opportunities that opened and closed in
          between. Nobody decided not to bid. The tender simply went unseen.
        </p>
        <p>
          The second problem is the paperwork. Even a straightforward bid asks for
          a technical proposal, a pricing schedule and compliance documents. For a
          team without a dedicated bid writer, that is the real reason a good
          opportunity goes unanswered: not the decision, the week it would cost.
        </p>
      </Section>

      <Section heading="What Quick Tenders does about it">
        <Bullets
          items={[
            'Watches tender feeds continuously rather than on the day someone remembers to look.',
            'Scores each tender against your sectors, region and company size, so the list stays short enough to read.',
            'Drafts the response pack for anything worth bidding on, not just a link to go and read.',
            'Tracks the deadline on every match until it is submitted or it closes.',
          ]}
        />
      </Section>

      <Section heading="How we think about drafts">
        <p>
          A draft is a starting point, never a submission. The agent writes the
          first version so that a person can spend their time on the parts that
          need judgement: the pricing, the feasibility, whether this contract is
          one worth winning.
        </p>
        <p>
          Responsibility for what gets submitted stays with the company doing the
          submitting. That is deliberate, and it is why every match arrives as
          something to review rather than something to send.
        </p>
      </Section>

      <Section heading="One account per company">
        <p>
          An account is tied to a company email domain, so one company gets one
          account and there is no seat management to administer. A single
          representative can run the whole pipeline, from the first match through
          to submission.
        </p>
        <p>
          Every new account starts with a 3-day free trial. If you want the
          specifics of how one company is kept separate from another, that is
          written up on the{' '}
          <Link
            href="/security"
            className="rounded-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
          >
            security page
          </Link>
          .
        </p>
      </Section>
    </ContentPage>
  )
}
