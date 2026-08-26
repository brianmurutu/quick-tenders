import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AppHeader } from '@/components/app-header'
import { documentLabel } from '@/lib/document-types'
import { createClient } from '@/lib/supabase/server'
import {
  STATUS_LABELS,
  deadlinePhrase,
  formatDate,
  formatMatchScore,
  isUrgent,
  isUuid,
  isoToday,
  tenderBucket,
} from '@/lib/tender-status'

import { MarkReviewedOnView, MarkSubmittedButton } from './tender-actions'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: { id: string }
}): Promise<Metadata> {
  if (!isUuid(params.id)) return { title: 'Tender | Quick Tenders' }

  const supabase = createClient()
  const { data } = await supabase
    .from('tenders_matched')
    .select('title')
    .eq('id', params.id)
    .maybeSingle()

  return { title: `${data?.title ?? 'Tender'} | Quick Tenders` }
}

export default async function TenderDetailPage({ params }: { params: { id: string } }) {
  // A non-uuid would make Postgres raise on the comparison rather than return no
  // rows, so reject the shape before querying.
  if (!isUuid(params.id)) notFound()

  const supabase = createClient()

  const { data: tender } = await supabase
    .from('tenders_matched')
    .select(
      'id, title, procuring_entity, deadline, summary, match_score, status, source_url, created_at',
    )
    .eq('id', params.id)
    .maybeSingle()

  // RLS scopes this to the caller company, so another company tender simply
  // returns nothing. 404 rather than 403 is right: it does not confirm the row
  // exists to somebody who cannot see it.
  if (!tender) notFound()

  const { data: documents } = await supabase
    .from('tender_documents')
    .select('id, doc_type, storage_path, created_at')
    .eq('tender_id', tender.id)
    .order('doc_type', { ascending: true })

  const today = isoToday()
  const bucket = tenderBucket(tender, today)
  const urgent = bucket !== 'submitted' && isUrgent(tender.deadline, today)

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <AppHeader
        right={
          <Link
            href="/dashboard"
            className="rounded-sm font-medium text-slate-600 transition-colors hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
          >
            Back to tenders
          </Link>
        }
      />

      {/* Renders nothing. Flips new to reviewed now that the page is really open. */}
      <MarkReviewedOnView tenderId={tender.id} currentStatus={tender.status} />

      <main className="mx-auto max-w-5xl px-6 py-12 lg:px-8">
        <p className="text-sm font-medium text-slate-500">
          {tender.procuring_entity ?? 'Procuring entity not stated'}
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {tender.title ?? 'Untitled tender'}
        </h1>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700 ring-1 ring-slate-200">
            {STATUS_LABELS[tender.status]}
          </span>
          <span className={urgent ? 'font-semibold text-red-700' : 'text-slate-600'}>
            {deadlinePhrase(tender.deadline, today)}
          </span>
          <span className="text-slate-600">
            {formatMatchScore(tender.match_score)} match
          </span>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
          <div>
            <section aria-labelledby="summary-heading">
              <h2 id="summary-heading" className="text-xl font-semibold tracking-tight">
                Why this matched
              </h2>
              <p className="mt-4 leading-relaxed text-slate-600">
                {tender.summary ?? 'No summary was recorded for this match.'}
              </p>
            </section>

            <section aria-labelledby="documents-heading" className="mt-12">
              <h2 id="documents-heading" className="text-xl font-semibold tracking-tight">
                Drafted documents
              </h2>

              {documents && documents.length > 0 ? (
                <>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    These are first drafts. Every bracketed placeholder needs
                    completing and every statement needs checking before anything
                    is submitted.
                  </p>

                  <ul className="mt-6 space-y-3">
                    {documents.map((document) => (
                      <li
                        key={document.id}
                        className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-5"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">
                            {documentLabel(document.doc_type)}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Word document, drafted {formatDate(document.created_at)}
                          </p>
                        </div>

                        {/*
                          Goes through a route handler rather than linking Storage
                          directly: the bucket is private, so each click mints a
                          fresh short lived signed URL instead of baking one into
                          this HTML where it would outlive the page and be
                          shareable.
                        */}
                        <a
                          href={`/api/documents/${document.id}`}
                          className="shrink-0 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                        >
                          Download
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-6">
                  <p className="font-semibold text-slate-900">No documents yet</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Drafting runs on its own schedule shortly after a match is
                    found, so these usually appear within a few minutes. If they
                    have not arrived, the next run will pick this tender up again.
                  </p>
                </div>
              )}
            </section>
          </div>

          <aside className="lg:pt-1">
            <div className="rounded-xl border border-slate-200 p-6">
              <h2 className="text-sm font-semibold text-slate-900">Details</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <Detail label="Procuring entity" value={tender.procuring_entity} />
                <Detail label="Closing date" value={formatDate(tender.deadline)} />
                <Detail label="Match score" value={formatMatchScore(tender.match_score)} />
                <Detail label="Found" value={formatDate(tender.created_at)} />
              </dl>

              {tender.source_url ? (
                <p className="mt-5 border-t border-slate-200 pt-5">
                  <a
                    href={tender.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-sm text-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700"
                  >
                    Open the original notice
                  </a>
                </p>
              ) : null}
            </div>

            <div className="mt-6">
              <MarkSubmittedButton
                tenderId={tender.id}
                alreadySubmitted={tender.status === 'submitted'}
              />
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900">{value ?? 'Not stated'}</dd>
    </div>
  )
}
