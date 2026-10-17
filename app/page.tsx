import Link from 'next/link'

import { container } from '@/components/layout'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { getSiteUrl } from '@/lib/env'
import { publicPageMetadata } from '@/lib/seo'

export const metadata = publicPageMetadata({
  title: 'Tender Matching & Bid Drafting in Kenya',
  description:
    'Find public tenders across Kenya, match opportunities to your business, and get bid documents drafted for your representative to review and sign.',
  path: '/',
})

const sources = [
  'PPIP',
  'All 47 counties',
  'KeNHA',
  'KPLC',
  'KPA',
  'KEMSA',
  'KenGen',
  'ICT Authority',
  'AGPO',
  'And more parastatals',
]

const steps = [
  {
    title: 'Tell us what you supply',
    body: 'Add your business details, categories, and the counties you serve.',
  },
  {
    title: 'Review matched tenders',
    body: 'See new opportunities scored against your company profile and deadlines.',
  },
  {
    title: 'Check the bid pack and sign',
    body: 'Review the drafted Word documents, make changes, then sign and submit.',
  },
]

const reasons = [
  {
    title: 'Find opportunities in one place',
    body: 'Check tenders from PPIP, county governments, and public agencies without searching every portal.',
  },
  {
    title: 'Spend less time on paperwork',
    body: 'Get a structured draft pack with forms, schedules, and supporting documents ready to review.',
  },
  {
    title: 'Keep the final say',
    body: 'One representative checks every detail and signs before anything is submitted.',
  },
]

const trialFeatures = [
  'Tender matches for your business',
  'Daily checks across public tender sources',
  'Opportunity fit scores and closing dates',
  'Draft bid documents in Word',
  'Company profile matching',
  'Three days to review the service',
]

const proFeatures = [
  'Ongoing tender monitoring',
  'Opportunity fit scores and deadlines',
  'Coverage across counties and public agencies',
  'Draft packs in Word for your team to review',
  'Forms, schedules, and supporting documents',
  'Your representative reviews and signs',
]

export default function Home() {
  const siteUrl = getSiteUrl()
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'Quick Tenders',
        url: siteUrl,
        logo: new URL('/logo-mark.svg', siteUrl).toString(),
      },
      {
        '@type': 'WebSite',
        name: 'Quick Tenders',
        url: siteUrl,
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
        }}
      />
      <div className="home-page">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">
          <Hero />
          <SourceStrip />
          <HowItWorks />
          <WhyQuickTenders />
          <Pricing />
        </main>
        <SiteFooter />
      </div>
    </>
  )
}

function Hero() {
  return (
    <section className="hero-section">
      <div className="hero-wrap hero-layout">
        <div className="hero-copy">
          <h1>
            Tenders found.
            <br />
            Bids drafted.
            <br />
            You sign.
          </h1>
          <p>
            Find public tenders across Kenya and get a first draft of the bid
            pack. Your representative reviews it, makes the final call, and
            signs.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/signup">
              Get Demo
            </Link>
            <Link className="button button-ghost" href="#how-it-works">
              See how it works
            </Link>
          </div>
          <ul className="hero-assurances" aria-label="Service details">
            <li>KES 0 for 3 days</li>
            <li>One company per domain</li>
            <li>Pay with M-Pesa or card</li>
          </ul>
        </div>
        <TenderNotice />
      </div>
    </section>
  )
}

function TenderNotice() {
  return (
    <article className="tender-paper" aria-label="Example matched tender">
      <div className="paper-topline">
        <span>Invitation to tender</span>
        <span className="paper-reference">Public notice</span>
      </div>

      <div className="notice-body">
        <p className="notice-agency">Kenya National Highways Authority</p>
        <h2>Road maintenance and safety upgrades</h2>
        <p className="notice-number">Tender no. KeNHA/2756/2026</p>
        <dl className="notice-details">
          <div>
            <dt>Estimated value</dt>
            <dd>KES 48.5M</dd>
          </div>
          <div>
            <dt>Match to your business</dt>
            <dd className="notice-fit">
              <span>96% fit</span>
              <span className="fit-bar" aria-hidden="true"><i /></span>
            </dd>
          </div>
          <div>
            <dt>Closing date</dt>
            <dd>27 November 2026</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>Nairobi and Central</dd>
          </div>
        </dl>
        <div className="draft-pack">
          <div className="draft-heading">
            <h3>Draft bid pack</h3>
            <span>Ready for review</span>
          </div>
          <ul>
            <li><span aria-hidden="true">✓</span> Form of tender</li>
            <li><span aria-hidden="true">✓</span> Technical proposal</li>
            <li><span aria-hidden="true">✓</span> Priced bill of quantities</li>
            <li><span aria-hidden="true">✓</span> Compliance documents</li>
          </ul>
        </div>
      </div>
      <div className="ready-stamp" aria-hidden="true">
        Ready to sign
      </div>
    </article>
  )
}

function SourceStrip() {
  return (
    <section className="source-strip" aria-labelledby="sources-heading">
      <div className={`${container} source-content`}>
        <h2 id="sources-heading">Live sources</h2>
        <ul>
          {sources.map((source) => (
            <li key={source}>{source}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="content-section steps-section"
      aria-labelledby="steps-heading"
    >
      <div className={container}>
        <div className="steps-layout">
          <div className="steps-content">
            <div className="section-intro">
              <h2 id="steps-heading">How it works</h2>
              <p>Three steps. One person reviews and signs.</p>
            </div>
            <ol className="steps-list">
              {steps.map((step, index) => (
                <li key={step.title}>
                  <span className="step-number">{index + 1}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <WorkflowIllustration />
        </div>
      </div>
    </section>
  )
}

function WorkflowIllustration() {
  const stages = [
    {
      id: 'sources',
      label: 'Discover',
      title: 'Tender opportunities',
      detail: 'Public sources across Kenya',
      column: 'one',
      row: 'one',
    },
    {
      id: 'match',
      label: 'Match',
      title: 'Check your fit',
      detail: 'Your categories and location',
      column: 'two',
      row: 'one',
    },
    {
      id: 'decision',
      label: 'Decide',
      title: 'Relevant tender?',
      detail: 'Based on your business',
      column: 'three',
      row: 'one',
    },
    {
      id: 'draft',
      label: 'Prepare',
      title: 'Draft bid pack',
      detail: 'Documents ready to review',
      column: 'two',
      row: 'two',
    },
    {
      id: 'monitor',
      label: 'Continue',
      title: 'Keep looking',
      detail: 'More tenders may match',
      column: 'three',
      row: 'two',
    },
    {
      id: 'review',
      label: 'Your turn',
      title: 'Review and sign',
      detail: 'You make the final call',
      column: 'two',
      row: 'three',
    },
  ]

  return (
    <figure className="workflow-illustration">
      <figcaption>
        <span>From opportunity to signature</span>
        <span className="workflow-caption-note">Illustrative process</span>
      </figcaption>
      <div
        className="workflow-canvas"
        role="img"
        aria-label="Illustration showing public tender opportunities matched to a business, relevant tenders leading to a draft bid pack for review and signature, and other opportunities continuing to be monitored."
      >
        <svg className="workflow-grid" viewBox="0 0 600 400" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <pattern id="workflow-dots" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="var(--on-brand)" fillOpacity=".14" />
            </pattern>
          </defs>
          <rect width="600" height="400" fill="url(#workflow-dots)" />
        </svg>
        <svg className="workflow-connections" viewBox="0 0 600 400" preserveAspectRatio="none" aria-hidden="true">
          <path d="M190 60 H205 M395 60 H410" />
          <path d="M505 120 C505 130 300 130 300 140" />
          <path d="M505 120 V140" />
          <path d="M300 260 V280" />
          <circle cx="190" cy="60" r="4" />
          <circle cx="205" cy="60" r="4" />
          <circle cx="395" cy="60" r="4" />
          <circle cx="410" cy="60" r="4" />
          <circle cx="300" cy="140" r="4" />
          <circle cx="505" cy="140" r="4" />
          <circle cx="300" cy="280" r="4" />
        </svg>
        <ol className="workflow-nodes">
          {stages.map((stage) => (
            <li
              className={`workflow-node workflow-node-${stage.id} workflow-column-${stage.column} workflow-row-${stage.row}`}
              key={stage.id}
            >
              <span className="workflow-node-label">{stage.label}</span>
              <strong>{stage.title}</strong>
              <span className="workflow-node-detail">{stage.detail}</span>
            </li>
          ))}
        </ol>
      </div>
    </figure>
  )
}

function WhyQuickTenders() {
  return (
    <section
      id="why"
      className="content-section why-section"
      aria-labelledby="why-heading"
    >
      <div className={container}>
        <div className="section-intro">
          <h2 id="why-heading">Why Quick Tenders</h2>
          <p>Less searching. Less repeat paperwork. You stay in control.</p>
        </div>
        <dl className="reason-list">
          {reasons.map((reason) => (
            <div className="reason-row" key={reason.title}>
              <dt>{reason.title}</dt>
              <dd>{reason.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

function Pricing() {
  return (
    <section
      id="pricing"
      className="content-section pricing-section"
      aria-labelledby="pricing-heading"
    >
      <div className={container}>
        <div className="section-intro">
          <h2 id="pricing-heading">Simple pricing</h2>
          <p>Start with a three-day trial. Keep going when you are ready.</p>
        </div>
        <div className="pricing-plans">
          <article className="plan-card">
            <h3>Free trial</h3>
            <p className="plan-price">
              <span>KES 0</span>
              <span>for 3 days</span>
            </p>
            <ul>
              {trialFeatures.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
            <Link className="button button-secondary" href="/signup">
              Get Demo
            </Link>
          </article>
          <article className="plan-card plan-pro">
            <h3>Pro</h3>
            <p className="plan-price">
              <span>KES 3,499</span>
              <span>per month</span>
            </p>
            <ul>
              {proFeatures.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
            <Link className="button button-light" href="/signup?plan=pro">
              Get started
            </Link>
          </article>
        </div>
      </div>
    </section>
  )
}
