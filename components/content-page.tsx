import type { ReactNode } from 'react'

import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'

/** Shared shell for the standing content pages (about, legal, careers). */
export function ContentPage({
  eyebrow,
  title,
  intro,
  notice,
  updated,
  children,
}: {
  eyebrow: string
  title: string
  intro?: ReactNode
  notice?: ReactNode
  updated?: string
  children: ReactNode
}) {
  return (
    <div className="bg-white text-slate-900">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-20 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
          {eyebrow}
        </p>

        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          {title}
        </h1>

        {intro ? (
          <div className="mt-6 text-lg leading-relaxed text-slate-600">{intro}</div>
        ) : null}

        {updated ? (
          <p className="mt-6 text-sm text-slate-500">Last updated {updated}.</p>
        ) : null}

        {notice ? <div className="mt-8">{notice}</div> : null}

        <div className="mt-12 space-y-12">{children}</div>
      </main>

      <SiteFooter />
    </div>
  )
}

export function Section({
  heading,
  children,
}: {
  heading: string
  children: ReactNode
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight text-slate-900">
        {heading}
      </h2>
      <div className="mt-4 space-y-4 leading-relaxed text-slate-600">{children}</div>
    </section>
  )
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3">
          <span
            aria-hidden="true"
            className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

/** Flat callout used to mark the legal pages as unreviewed drafts. */
export function DraftNotice({ children }: { children: ReactNode }) {
  return (
    <div
      role="note"
      className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm leading-relaxed text-amber-900"
    >
      <p className="font-semibold">Draft, not yet reviewed by a lawyer</p>
      <p className="mt-2">{children}</p>
    </div>
  )
}

export function ContactBlock({
  label,
  email,
  children,
}: {
  label: string
  email: string
  children: ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-5">
      <h3 className="text-base font-semibold text-slate-900">{label}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{children}</p>
      <a
        href={`mailto:${email}`}
        className="mt-3 inline-block rounded-sm text-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
      >
        {email}
      </a>
    </div>
  )
}
