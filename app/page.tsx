import Link from 'next/link'

import { container, sectionHeaderGap, sectionY } from '@/components/layout'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'

const steps = [
  {
    title: '1. Register your Kenyan business',
    body: 'Sign up with your work email. Enter your KRA PIN, AGPO category (Youth, Women, PWD), and business profile once.',
    tag: 'AGPO & KRA Ready',
  },
  {
    title: '2. Select your tender categories',
    body: 'Choose your sectors (NCA Construction, ICT, Healthcare, Security, Supply) and target counties across Kenya.',
    tag: '47 Counties & Parastatals',
  },
  {
    title: '3. AI scans PPIP & drafts your bids',
    body: 'Our agent checks national and county portals 24/7, scores your win probability, and drafts complete response packs in Word.',
    tag: 'Continuous PPIP Crawler',
  },
  {
    title: '4. Proofread, seal & submit',
    body: 'Review the generated technical proposals and pricing schedules, add your signatures, and submit before the deadline.',
    tag: 'PPADA Compliant',
  },
]

const valueProps = [
  {
    title: 'Never miss a National or County tender',
    body: 'Tenders on PPIP, MyGov, and county portals close rapidly. The agent tracks every deadline across Kenya and notifies you instantly.',
    icon: RadarIcon,
    accent: 'border-emerald-500/20 bg-emerald-50/40',
  },
  {
    title: 'PPADA-compliant bids drafted in minutes',
    body: 'Get complete Word (.docx) packs including Form of Tender, Technical Proposal (Form T-1 to T-5), compliance matrices, and cover letters.',
    icon: DocumentIcon,
    accent: 'border-blue-500/20 bg-blue-50/40',
  },
  {
    title: 'Win more contracts with zero extra staff',
    body: 'A single director or business development rep can review and submit 10+ tenders a week without hiring an expensive procurement agency.',
    icon: PersonIcon,
    accent: 'border-red-500/20 bg-red-50/40',
  },
]

const procurementSources = [
  'PPIP Kenya (Public Procurement Information Portal)',
  'Kenya National Highways Authority (KeNHA)',
  'Kenya Power & Lighting (KPLC)',
  'Kenya Ports Authority (KPA)',
  'KEMSA Medical Supplies',
  'All 47 County Governments',
  'ICT Authority Kenya',
  'Geothermal Development (GDC)',
  'KenGen',
  'AGPO Portal',
]

export default function Home() {
  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-900 overflow-hidden">
      {/* Ambient Kenyan-inspired background light cones */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/4 -right-40 h-[28rem] w-[28rem] rounded-full bg-red-500/5 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-1/3 left-1/4 h-80 w-80 rounded-full bg-emerald-600/5 blur-3xl"
      />

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>

      <SiteHeader />

      <main id="main">
        <Hero />
        <ProcurementTicker />
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
    <section className="relative border-b border-slate-200/80 bg-white/70 backdrop-blur-sm">
      {/* Subtle procurement watermark grid background */}
      <div className="absolute inset-0 bg-procurement-grid opacity-60" aria-hidden="true" />

      <div
        className={`${container} ${sectionY} relative grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-12`}
      >
        <div>
          {/* Kenya National Tendering Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50/90 px-3.5 py-1 text-xs font-semibold text-emerald-900 shadow-sm backdrop-blur">
            <span className="flex h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
            <span>🇰🇪 Kenya&apos;s AI Tender Copilot • PPIP &amp; County RFPs</span>
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-[3.25rem] lg:leading-[1.1] text-slate-950">
            An AI agent that finds your Kenyan tenders and drafts winning bids
          </h1>

          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Quick Tenders monitors PPIP, 47 County Governments, and Kenyan parastatals 24/7.
            It scores opportunities against your company profile and writes fully structured,
            PPADA-compliant Word proposal packs ready for your signature.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-md bg-blue-700 px-6 py-3 text-base font-semibold text-white shadow-sm transition-all hover:bg-blue-800 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Get Demo (3-Day Free Trial)
            </Link>

            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-6 py-3 text-base font-semibold text-slate-900 transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              See how it works
            </a>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-slate-500">
            <span className="flex items-center gap-1 text-emerald-700">
              <span className="font-bold">✓</span> KES 0 for 3 days
            </span>
            <span className="flex items-center gap-1 text-slate-600">
              <span className="font-bold">✓</span> One company per domain
            </span>
            <span className="flex items-center gap-1 text-slate-600">
              <span className="font-bold">✓</span> M-Pesa &amp; Card billing
            </span>
          </div>
        </div>

        <HeroPanel />
      </div>
    </section>
  )
}

/**
 * Illustrative Kenyan procurement panel.
 */
function HeroPanel() {
  return (
    <div className="relative rounded-2xl border border-slate-200/90 bg-slate-900/5 p-4 sm:p-6 shadow-sm backdrop-blur-sm">
      {/* Decorative top accent line with Kenya tri-colors */}
      <div className="kenya-stripe absolute inset-x-0 top-0 h-[2px] rounded-t-2xl" aria-hidden="true" />

      <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
            PPIP &amp; County Live Feed
          </p>
        </div>
        <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
          3 New Matches Today
        </span>
      </div>

      {/* Featured Matched Kenyan Tender */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-blue-700">
              Kenya National Highways Authority (KeNHA)
            </span>
            <h2 className="text-sm font-bold text-slate-900">
              Tender No. KeNHA/2756/2026: Road Maintenance &amp; Safety Upgrades
            </h2>
          </div>
          <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
            96% Fit Score
          </span>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-y border-slate-100 py-2.5 text-xs text-slate-600 sm:grid-cols-4">
          <div>
            <dt className="text-slate-400">Closes</dt>
            <dd className="font-semibold text-red-600">in 11 days</dd>
          </div>
          <div>
            <dt className="text-slate-400">Region</dt>
            <dd className="font-semibold text-slate-800">Nairobi &amp; Central</dd>
          </div>
          <div>
            <dt className="text-slate-400">Target Value</dt>
            <dd className="font-semibold text-slate-800">KES 48.5M Est.</dd>
          </div>
          <div>
            <dt className="text-slate-400">Category</dt>
            <dd className="font-semibold text-slate-800">NCA 1–4 Civil</dd>
          </div>
        </dl>

        <div className="mt-3.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              AI Drafted Documents Ready (.docx)
            </p>
            <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              PPADA Compliant
            </span>
          </div>

          <ul className="mt-2 space-y-1.5">
            {[
              'Form of Tender & Technical Proposal (Form T-1 to T-5)',
              'Priced Bill of Quantities (BoQ) & Work Methodology',
              'KRA Tax Compliance, CR12 & NCA Verification Dossier',
              'Tender Securing Declaration & Anti-Corruption Form',
            ].map((doc) => (
              <li key={doc} className="flex items-center gap-2 text-xs text-slate-700">
                <CheckIcon />
                <span className="truncate">{doc}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Secondary tender feed peek */}
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-white/90 px-3.5 py-2.5 text-xs text-slate-700">
          <div className="flex items-center gap-2 truncate">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
            <span className="font-medium truncate">Ministry of Water • Community Solar Borehole Drilling (Kitui)</span>
          </div>
          <span className="shrink-0 text-[11px] font-semibold text-emerald-700">92% match</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-white/90 px-3.5 py-2.5 text-xs text-slate-700">
          <div className="flex items-center gap-2 truncate">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
            <span className="font-medium truncate">Kenya Power (KPLC) • Smart Grid Metering Hardware Supply</span>
          </div>
          <span className="shrink-0 text-[11px] font-semibold text-emerald-700">89% match</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Ticker displaying key Kenyan procurement portals monitored.
 */
function ProcurementTicker() {
  return (
    <section aria-label="Monitored Portals" className="border-b border-slate-200 bg-slate-900 text-white py-3.5">
      <div className={`${container} flex flex-col md:flex-row md:items-center justify-between gap-3`}>
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            Active Kenya Feeds:
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-slate-300">
          {procurementSources.slice(0, 5).map((source) => (
            <span key={source} className="flex items-center gap-1.5">
              <span className="text-slate-500">•</span>
              {source}
            </span>
          ))}
          <span className="text-blue-400 font-semibold">+ 42 more parastatals &amp; counties</span>
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="scroll-mt-16 border-b border-slate-200 bg-white"
    >
      <div className={`${container} ${sectionY}`}>
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-700">
            <span>Seamless 4-Step Process</span>
          </div>
          <h2
            id="how-it-works-heading"
            className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl"
          >
            How Quick Tenders works for Kenyan bidders
          </h2>
          <p className="mt-2 text-base leading-relaxed text-slate-600">
            From registration to submitting your response pack in 4 easy steps. The AI agent automates the heavy lifting.
          </p>
        </div>

        <ol
          className={`${sectionHeaderGap} grid gap-6 sm:grid-cols-2 lg:grid-cols-4`}
        >
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="relative flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-5 transition-all hover:border-slate-300 hover:bg-slate-50"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 text-xs font-bold text-white shadow-sm">
                    {index + 1}
                  </span>
                  <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                    {step.tag}
                  </span>
                </div>
                <h3 className="mt-4 text-sm font-bold text-slate-900">
                  {step.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  {step.body}
                </p>
              </div>
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
      className="scroll-mt-16 border-b border-slate-200 bg-slate-50/60"
    >
      <div className={`${container} ${sectionY}`}>
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800">
            <span>Competitive Advantage</span>
          </div>
          <h2 id="why-heading" className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Why leading Kenyan contractors use Quick Tenders
          </h2>
          <p className="mt-2 text-base leading-relaxed text-slate-600">
            Most tenders are missed because discovery is scattered across dozens of portals or because bid paperwork takes weeks to compile.
          </p>
        </div>

        <div className={`${sectionHeaderGap} grid gap-5 md:grid-cols-3`}>
          {valueProps.map(({ title, body, icon: Icon, accent }) => (
            <article
              key={title}
              className={`rounded-xl border p-6 transition-all hover:shadow-sm ${accent} border-slate-200 bg-white`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm">
                <Icon />
              </span>
              <h3 className="mt-4 text-base font-bold text-slate-900">{title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function Pricing() {
  return (
    <section id="pricing" aria-labelledby="pricing-heading" className="relative scroll-mt-16 bg-slate-950 text-white overflow-hidden">
      {/* Subtle ambient glows for pricing section */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 h-96 w-96 rounded-full bg-emerald-600/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 h-96 w-96 rounded-full bg-red-600/10 blur-3xl"
      />

      <div className={`${container} ${sectionY} relative`}>
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/60 px-3 py-1 text-xs font-semibold text-emerald-300">
            <span>🇰🇪 Pricing in Kenyan Shillings (KES)</span>
          </div>
          <h2
            id="pricing-heading"
            className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl"
          >
            Start with 3 days free, upgrade when you win
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300 sm:text-base">
            Full access to AI discovery and bid drafting from minute one. No credit card required to begin.
          </p>
        </div>

        <div className={`${sectionHeaderGap} mx-auto grid gap-6 md:grid-cols-2 lg:max-w-4xl`}>
          {/* Trial Card */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/80 p-6 sm:p-7 shadow-sm transition-all hover:border-slate-700">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">3-Day Free Trial</h3>
                <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-300 border border-slate-700">
                  Instant Access
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-300">
                Experience full autonomous tender finding and AI bid drafting on day one.
              </p>

              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold tracking-tight text-white">KES 0</span>
                <span className="text-xs font-medium text-slate-400">/ 3 days full trial</span>
              </div>

              <ul className="mt-6 space-y-2.5 text-xs text-slate-300">
                {[
                  'Full AI tender discovery & scoring across PPIP',
                  'Automated Word (.docx) proposal drafts',
                  'Instant email alerts on new high-fit matches',
                  'One company account with email domain lock',
                  'No payment details required upfront',
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                      ✓
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-7">
              <Link
                href="/signup"
                className="inline-flex w-full items-center justify-center rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Get Demo (Free Trial)
              </Link>
            </div>
          </div>

          {/* Pro Subscription Card */}
          <div className="relative flex flex-col justify-between rounded-2xl border-2 border-emerald-500/80 bg-slate-900 p-6 sm:p-7 shadow-xl">
            <div className="absolute -top-3 right-6 rounded-full bg-emerald-600 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
              Recommended
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Quick Tenders Pro</h3>
              </div>
              <p className="mt-2 text-xs text-slate-300">
                Continuous AI procurement intelligence and unlimited bid generation.
              </p>

              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold tracking-tight text-white">KES 2,000</span>
                <span className="text-xs font-medium text-slate-400">/ month</span>
              </div>

              <ul className="mt-6 space-y-2.5 text-xs text-slate-300">
                {[
                  'Continuous monitoring of PPIP, 47 counties & parastatals',
                  'AI fit scoring tailored to your exact profile & AGPO status',
                  'Complete Word (.docx) proposal packs ready to sign & submit',
                  'Email & SMS alerts for high-priority matching tenders',
                  'Unlimited tender tracking, pipeline & archived bids',
                  'Lipa na M-Pesa & Card billing via Paystack (Cancel anytime)',
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-slate-950 font-bold text-[10px]">
                      ✓
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-7">
              <Link
                href="/signup"
                className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
              >
                Start Free Trial &amp; Subscribe
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Lipa na M-Pesa Supported
          </span>
          <span>•</span>
          <span>Secure checkout via Paystack</span>
          <span>•</span>
          <span>Official KRA compliant receipt</span>
        </div>
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
      className="h-5 w-5"
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
      className="h-5 w-5"
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
      className="h-5 w-5"
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
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5 shrink-0 text-emerald-600"
    >
      <path d="m4 10.5 4 4 8-9" />
    </svg>
  )
}
