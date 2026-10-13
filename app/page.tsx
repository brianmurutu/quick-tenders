import Link from 'next/link'

import { container } from '@/components/layout'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'

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
  'Draft bid documents in Word',
  'Three days to review the service',
]

const proFeatures = [
  'Ongoing tender monitoring',
  'Opportunity fit scores and deadlines',
  'Draft packs for your team to review',
]

export default function Home() {
  return (
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
  )
}

function Hero() {
  return (
    <section className="hero-section">
      <div className={`${container} hero-layout`}>
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
          <Link className="button button-primary" href="/signup">
            Get Demo
          </Link>
        </div>
        <TenderNotice />
      </div>
    </section>
  )
}

function TenderNotice() {
  return (
    <article className="tender-paper" aria-label="Example tender and drafted bid pack">
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
            <dd>96% fit</dd>
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
      <div className="ready-stamp" aria-label="Ready to sign">
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
    </section>
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
              <span>KES 2,000</span>
              <span>per month</span>
            </p>
            <ul>
              {proFeatures.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
            <Link className="button button-light" href="/signup">
              Get Demo
            </Link>
          </article>
        </div>
      </div>
    </section>
  )
}
