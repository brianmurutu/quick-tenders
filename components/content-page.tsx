import type { ReactNode } from 'react'

import { Breadcrumbs } from '@/components/breadcrumbs'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { Card, PageShell, Prose } from '@/components/ui'

/** Shared shell for the standing content pages (about, legal, careers). */
export function ContentPage({
  eyebrow,
  title,
  breadcrumbPath,
  intro,
  notice,
  updated,
  children,
}: {
  eyebrow: string
  title: string
  breadcrumbPath: string
  intro?: ReactNode
  notice?: ReactNode
  updated?: string
  children: ReactNode
}) {
  return (
    <PageShell>
      <SiteHeader />

      <main className="page-shell-main">
        <Prose>
          <Breadcrumbs currentPage={title} currentPath={breadcrumbPath} />

          <p className="page-eyebrow">
            {eyebrow}
          </p>

          <h1 className="page-title">
            {title}
          </h1>

          {intro ? (
            <div className="page-intro">{intro}</div>
          ) : null}

          {updated ? (
            <p className="page-updated">Last updated {updated}.</p>
          ) : null}

          {notice ? <div className="page-notice">{notice}</div> : null}

          <div className="page-sections">{children}</div>
        </Prose>
      </main>

      <SiteFooter />
    </PageShell>
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
      <h2>
        {heading}
      </h2>
      <div className="page-section-copy">{children}</div>
    </section>
  )
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="page-bullets">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3">
          <span aria-hidden="true" className="page-bullet" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

/** Flat callout used to mark the legal pages as unreviewed drafts. */
export function DraftNotice({ children }: { children: ReactNode }) {
  return (
    <Card
      role="note"
      className="draft-notice"
    >
      <p className="font-semibold">Draft, not yet reviewed by a lawyer</p>
      <p>{children}</p>
    </Card>
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
    <Card className="contact-block">
      <h3>{label}</h3>
      <p>{children}</p>
      <a
        href={`mailto:${email}`}
        className="contact-email"
      >
        {email}
      </a>
    </Card>
  )
}
