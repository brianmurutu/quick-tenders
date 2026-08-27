import Link from 'next/link'

import { container, sectionHeaderGap, sectionY } from '@/components/layout'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'

const steps = [
  {
    title: 'Sign up with your company email',
    body: 'The account is tied to your email domain, so one company gets one account. No seat management, no invites to chase.',
  },
  {
    title: 'Tell us your industry',
    body: 'Pick the sectors, regions and company size that describe you. That profile is what every tender gets scored against.',
  },
  {
    title: 'Agent finds and drafts matching tenders',
    body: 'It watches tender feeds continuously, scores the fit, and drafts the full response pack for anything worth bidding on.',
  },
  {
    title: 'You proofread and submit',
    body: 'Read the draft, change what you want, then submit. Deadlines stay tracked until you do.',
  },
]

const valueProps = [
  {
    title: 'Never miss a tender',
    body: 'Tenders close on a fixed date whether or not anyone saw them. The agent checks continuously and surfaces every match with the deadline attached.',
    icon: RadarIcon,
  },
  {
    title: 'Documents drafted for you',
    body: 'A match arrives as a drafted response, not a link to go read. Summary, requirements and paperwork, written against your company profile.',
    icon: DocumentIcon,
  },
  {
    title: 'One rep, zero admin overhead',
    body: 'No procurement team, no shared inbox, no handover notes. A single representative can run the whole pipeline start to finish.',
    icon: PersonIcon,
  },
]

export default function Home() {
  return (
    <div className="bg-white text-slate-900">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>

      <SiteHeader />

      <main id="main">
        <Hero />
        <HowItWorks />
        <ValueProps />
        <Pricing />
      </main>

      <SiteFooter />
    </div>
  )
}

function Hero() {
  return (
    <section className="border-b border-slate-200">
      <div
        className={`${container} ${sectionY} grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-20`}
      >
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
            Tender bidding, automated
          </p>

          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[3.5rem] lg:leading-[1.05]">
            An AI agent that finds your tenders and drafts the bids
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
            Quick Tenders watches tender feeds for opportunities in your sector,
            scores each one against your company profile, then writes a first
            draft of every document you need to submit. You proofread and send.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-md bg-blue-700 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Get Demo
            </Link>

            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 px-6 py-3 text-base font-semibold text-slate-900 transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              See how it works
            </a>
          </div>

          <p className="mt-6 text-sm text-slate-500">
            3-day free trial. One account per company.
          </p>
        </div>

        <HeroPanel />
      </div>
    </section>
  )
}

/**
 * Illustrative product panel. The figures are placeholder copy, not real
 * tender data.
 */
function HeroPanel() {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">Matched tenders</p>
        <p className="text-xs font-medium text-slate-500">3 new today</p>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900">
            Municipal water infrastructure upgrade
          </p>
          <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
            94% match
          </span>
        </div>

        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
          <div className="flex gap-1.5">
            <dt className="font-medium text-slate-400">Closes</dt>
            <dd>in 12 days</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="font-medium text-slate-400">Region</dt>
            <dd>Nationwide</dd>
          </div>
        </dl>

        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Drafted for review
          </p>
          <ul className="mt-2.5 space-y-2">
            {['Technical proposal', 'Pricing schedule', 'Compliance checklist'].map(
              (doc) => (
                <li key={doc} className="flex items-center gap-2.5 text-sm text-slate-700">
                  <CheckIcon />
                  {doc}
                </li>
              ),
            )}
          </ul>
        </div>
      </div>

      <div className="mt-3 space-y-3" aria-hidden="true">
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
          <div className="h-2.5 w-1/2 rounded-full bg-slate-100" />
          <div className="h-2.5 w-10 rounded-full bg-slate-100" />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
          <div className="h-2.5 w-2/5 rounded-full bg-slate-100" />
          <div className="h-2.5 w-10 rounded-full bg-slate-100" />
        </div>
      </div>
    </div>
  )
}

function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="scroll-mt-16 border-b border-slate-200 bg-slate-50"
    >
      <div className={`${container} ${sectionY}`}>
        <div className="max-w-2xl">
          <h2
            id="how-it-works-heading"
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            How it works
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            Four steps from signing up to submitting a bid. The agent handles the
            middle two.
          </p>
        </div>

        <ol
          className={`${sectionHeaderGap} grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4`}
        >
          {steps.map((step, index) => (
            <li key={step.title}>
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-700 text-sm font-semibold text-white">
                {index + 1}
              </span>
              <h3 className="mt-5 text-base font-semibold text-slate-900">
                {step.title}
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function ValueProps() {
  return (
    <section
      id="why"
      aria-labelledby="why-heading"
      className="scroll-mt-16"
    >
      <div className={`${container} ${sectionY}`}>
        <div className="max-w-2xl">
          <h2 id="why-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Why Quick Tenders
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            Most bids are lost before anyone writes a word, either because the
            tender was never seen or because the paperwork ate the week.
          </p>
        </div>

        <div className={`${sectionHeaderGap} grid gap-6 md:grid-cols-3`}>
          {valueProps.map(({ title, body, icon: Icon }) => (
            <article
              key={title}
              className="rounded-xl border border-slate-200 p-7 transition-colors hover:border-slate-300"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <Icon />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-slate-900">{title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-600">{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function Pricing() {
  return (
    <section id="pricing" aria-labelledby="pricing-heading" className="scroll-mt-16 bg-slate-900 text-white">
      <div className={`${container} ${sectionY}`}>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
            Simple, Transparent Pricing
          </p>
          <h2
            id="pricing-heading"
            className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl"
          >
            Start with 3 days free, upgrade when you see the results
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-300 sm:text-lg">
            Every account begins with a full-access 3-day trial. No credit card required to start.
          </p>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-2 lg:max-w-4xl lg:mx-auto">
          {/* Trial Card */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-700 bg-slate-800/60 p-8 shadow-sm transition-all hover:border-slate-600">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">3-Day Free Trial</h3>
                <span className="rounded-full bg-slate-700 px-3 py-1 text-xs font-semibold text-slate-300">
                  No Commitment
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-300">
                Experience full autonomous tender finding and AI bid drafting on day one.
              </p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold tracking-tight text-white">KES 0</span>
                <span className="text-sm font-medium text-slate-400">/ 3 days</span>
              </div>

              <ul className="mt-8 space-y-3 text-sm text-slate-300">
                {[
                  'Full AI tender discovery & scoring',
                  'Automated Word (.docx) proposal drafts',
                  'Instant email alerts on new matches',
                  'One company account with email domain lock',
                  'No credit card required upfront',
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
                      ✓
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8">
              <Link
                href="/signup"
                className="inline-flex w-full items-center justify-center rounded-lg border border-slate-600 bg-slate-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Get Demo (Free Trial)
              </Link>
            </div>
          </div>

          {/* Pro Subscription Card */}
          <div className="relative flex flex-col justify-between rounded-2xl border-2 border-blue-500 bg-slate-800 p-8 shadow-xl">
            <div className="absolute -top-3.5 right-6 rounded-full bg-blue-600 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
              Recommended
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Quick Tenders Pro</h3>
              </div>
              <p className="mt-3 text-sm text-slate-300">
                Continuous AI procurement intelligence and automatic bid generation.
              </p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold tracking-tight text-white">KES 2,000</span>
                <span className="text-sm font-medium text-slate-400">/ month</span>
              </div>

              <ul className="mt-8 space-y-3 text-sm text-slate-300">
                {[
                  'Continuous monitoring of national & county portals',
                  'AI fit scoring tailored to your exact profile',
                  'Complete Word (.docx) proposal packs ready to edit',
                  'Email & SMS alerts for high-priority matches',
                  'Unlimited matched tender tracking & archive',
                  'M-Pesa & Card billing via Paystack (Cancel anytime)',
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white font-bold text-xs">
                      ✓
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8">
              <Link
                href="/signup"
                className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              >
                Start Free Trial & Subscribe
              </Link>
            </div>
          </div>
        </div>

        <p className="mt-12 text-center text-xs text-slate-400">
          Secure checkout via Paystack with M-Pesa and Card support. All prices in Kenyan Shillings (KES).
        </p>
      </div>
    </section>
  )
}

function RadarIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      className="h-6 w-6"
    >
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <path d="M12 12 18 6" />
    </svg>
  )
}

function DocumentIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <path d="M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V7.5Z" />
      <path d="M14 3v4.5h4.5" />
      <path d="M9 12.5h6M9 16h4" />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0 text-blue-700"
    >
      <path d="m4 10.5 4 4 8-9" />
    </svg>
  )
}
