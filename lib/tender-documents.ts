/**
 * The drafting run: draft documents for new matches, store them, record them,
 * and email the representative.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS ITS OWN SCHEDULED JOB, NOT PART OF THE MATCHING INSERT
 * ---------------------------------------------------------------------------
 *
 * The brief offered either. This is a separate scheduled job that picks up
 * tenders_matched rows with no documents yet, for four reasons:
 *
 *   1. Cost per row. Discovery scores 20 tenders in one Grok call. Drafting
 *      is two calls, two DOCX builds, two uploads and an email PER MATCH. Bolted
 *      onto discovery, one run with 30 new matches becomes 60 sequential model
 *      calls and blows the function timeout, taking the matching with it.
 *   2. Failure isolation. Resend being down should not roll back or fail a
 *      matching run. Here it just leaves notified_at null, and the next run
 *      retries only the notification.
 *   3. The queue is self healing. "Rows with no documents, or not yet notified"
 *      is derived from state, not from remembering an event, so anything that
 *      failed halfway is retried automatically with no dead letter queue.
 *   4. It covers rows discovery did not create: a manual insert, a backfill, or
 *      a re-import all get documents without special handling.
 *
 * The cost is latency: a match waits until the next tick rather than being
 * drafted the instant it lands. Run the schedules close together if that
 * matters, or POST to the endpoint at the end of a discovery run.
 */

import { buildTenderEmail } from '@/lib/email/tender-notification'
import { resendConfigHint, resendConfigured, sendEmail } from '@/lib/email/resend'
import { sendTenderNotificationSms, type TenderSmsInput } from '@/lib/sms/tender-notification-sms'
import { textSmsConfigured } from '@/lib/sms/textsms'
import { createAiClient } from '@/lib/tender-matching'
import { aiModel, type AiClient } from '@/lib/ai'
import {
  DOCUMENT_LABELS,
  DOCUMENT_TYPES,
  STORAGE_BUCKET,
  storagePath,
  type DraftDocumentType,
} from '@/lib/document-types'
import { draftDocument, renderDocument, type DraftContext } from '@/lib/tender-drafting'
import { DOCX_MIME } from '@/lib/docx'
import { createAdminClient, type SupabaseAdminClient } from '@/lib/supabase/admin'

export { STORAGE_BUCKET, storagePath }

export type PendingDraft = {
  tender_id: string
  title: string | null
  source_url: string | null
  deadline: string | null
  summary: string | null
  match_score: number | null
  procuring_entity: string | null
  notified_at: string | null
  document_count: number
  company_id: string
  company_name: string | null
  industry: string | null
  sectors_of_interest: string[] | null
  region: string | null
  company_size: string | null
  representative_name: string | null
  representative_emails: string[] | null
  /** Phone numbers for SMS notification (may be absent from older RPC versions). */
  representative_phones?: string[] | null
}

export type TenderDraftResult = {
  tenderId: string
  title: string | null
  companyName: string | null
  documentsCreated: DraftDocumentType[]
  emailed: boolean
  recipients: number
  skipped?: string
  errors: string[]
}

export type DraftingRunSummary = {
  startedAt: string
  finishedAt: string
  durationMs: number
  model: string
  emailConfigured: boolean
  pending: number
  tenders: TenderDraftResult[]
  totals: { documentsCreated: number; emailsSent: number }
  errors: string[]
}

function toDraftContext(pending: PendingDraft): DraftContext {
  return {
    tenderTitle: pending.title ?? 'Untitled tender',
    tenderSummary: pending.summary,
    procuringEntity: pending.procuring_entity,
    deadline: pending.deadline,
    sourceUrl: pending.source_url,
    companyName: pending.company_name,
    industry: pending.industry,
    sectorsOfInterest: pending.sectors_of_interest,
    region: pending.region,
    companySize: pending.company_size,
  }
}

export type RunOptions = {
  limit?: number
  dryRun?: boolean
  /**
   * Restricts the run to one company. Used by the verification harness so a test
   * account can be driven end to end without drafting for every other tenant.
   */
  companyId?: string
  /**
   * Overrides the LLM client. Production leaves this unset and gets the provider
   * from lib/ai.ts; the verification harness passes a deterministic stand-in so
   * the storage, email and dashboard stages can be exercised with no provider
   * credits. See scripts/verify-pipeline.mjs.
   */
  client?: AiClient
}

export async function runDrafting(
  options: RunOptions = {},
): Promise<DraftingRunSummary> {
  const startedAt = new Date()
  const errors: string[] = []
  const tenders: TenderDraftResult[] = []

  let supabase: SupabaseAdminClient
  let grok: AiClient

  try {
    supabase = createAdminClient()
    grok = options.client ?? createAiClient()
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error))

    return summarise(startedAt, 0, tenders, errors, grokModelOf(options))
  }

  const { data, error } = await supabase.rpc('pending_tender_drafts', {
    p_limit: options.limit ?? 25,
  })

  if (error) {
    errors.push(`Could not load pending drafts: ${error.message}`)

    return summarise(startedAt, 0, tenders, errors, grok.model)
  }

  const allPending = (data ?? []) as PendingDraft[]
  const pending = options.companyId
    ? allPending.filter((row) => row.company_id === options.companyId)
    : allPending

  if (options.dryRun) {
    for (const row of pending) {
      tenders.push({
        tenderId: row.tender_id,
        title: row.title,
        companyName: row.company_name,
        documentsCreated: [],
        emailed: false,
        recipients: row.representative_emails?.length ?? 0,
        skipped: `Dry run. Would draft ${
          row.document_count === 0 ? DOCUMENT_TYPES.length : 0
        } document(s) and ${row.notified_at ? 'not email' : 'email'}.`,
        errors: [],
      })
    }

    return summarise(startedAt, pending.length, tenders, errors, grok.model)
  }

  for (const row of pending) {
    tenders.push(await processTender(supabase, grok, row))
  }

  return summarise(startedAt, pending.length, tenders, errors, grok.model)
}

/** Best effort model name for a summary produced before a client could be built. */
function grokModelOf(options: RunOptions): string {
  if (options.client) return options.client.model

  try {
    return aiModel()
  } catch {
    return 'unconfigured'
  }
}

async function processTender(
  supabase: SupabaseAdminClient,
  grok: AiClient,
  pending: PendingDraft,
): Promise<TenderDraftResult> {
  const result: TenderDraftResult = {
    tenderId: pending.tender_id,
    title: pending.title,
    companyName: pending.company_name,
    documentsCreated: [],
    emailed: false,
    recipients: pending.representative_emails?.length ?? 0,
    errors: [],
  }

  const context = toDraftContext(pending)

  if (pending.document_count === 0) {
    for (const docType of DOCUMENT_TYPES) {
      try {
        const drafted = await draftDocument(grok, docType, context)

        if (!drafted) {
          result.errors.push(`${docType}: the model returned no usable document`)
          continue
        }

        const rendered = renderDocument(drafted, context)
        const path = storagePath(pending.company_id, pending.tender_id, docType)

        // upsert so a retry after a partial failure overwrites cleanly rather
        // than erroring on an object that is already there.
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, rendered.bytes, { contentType: DOCX_MIME, upsert: true })

        if (uploadError) {
          result.errors.push(`${docType}: upload failed, ${uploadError.message}`)
          continue
        }

        // Only recorded once the bytes are stored, so a tender_documents row
        // never points at an object that does not exist.
        const { error: insertError } = await supabase
          .from('tender_documents')
          .upsert(
            {
              tender_id: pending.tender_id,
              doc_type: docType,
              storage_path: path,
            },
            { onConflict: 'tender_id,doc_type', ignoreDuplicates: true },
          )

        if (insertError) {
          result.errors.push(`${docType}: could not record document, ${insertError.message}`)
          continue
        }

        result.documentsCreated.push(docType)
      } catch (error) {
        result.errors.push(
          `${docType}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
  }

  // Do not announce a match whose documents all failed. Left unnotified, so the
  // next run retries the drafting rather than sending an email with nothing
  // behind the link.
  const hasDocuments =
    pending.document_count > 0 || result.documentsCreated.length > 0

  if (pending.notified_at) return result

  if (!hasDocuments) {
    result.skipped = 'No documents yet, so the notification is held for the next run'

    return result
  }

  const recipients = (pending.representative_emails ?? []).filter(Boolean)

  if (recipients.length === 0) {
    result.skipped = 'Company has no representative to email'

    return result
  }

  if (!resendConfigured()) {
    result.skipped = resendConfigHint()

    return result
  }

  const labels =
    result.documentsCreated.length > 0
      ? result.documentsCreated.map((docType) => DOCUMENT_LABELS[docType])
      : DOCUMENT_TYPES.map((docType) => DOCUMENT_LABELS[docType])

  const email = buildTenderEmail({
    tenderId: pending.tender_id,
    title: pending.title ?? 'Untitled tender',
    procuringEntity: pending.procuring_entity,
    deadline: pending.deadline,
    matchScore: pending.match_score,
    summary: pending.summary,
    sourceUrl: pending.source_url,
    companyName: pending.company_name,
    representativeName: pending.representative_name,
    documentLabels: labels,
  })

  const sent = await sendEmail({
    to: recipients,
    subject: email.subject,
    html: email.html,
    text: email.text,
  })

  if (!sent.ok) {
    result.errors.push(`Email failed: ${sent.error}`)

    return result
  }

  result.emailed = true

  // Send SMS notification if phone numbers are available.
  const phones = (pending.representative_phones ?? []).filter(Boolean) as string[]

  if (phones.length > 0 && textSmsConfigured()) {
    const smsInput: TenderSmsInput = {
      tenderId: pending.tender_id,
      title: pending.title,
      deadline: pending.deadline,
      companyName: pending.company_name,
    }

    const smsSent = await sendTenderNotificationSms(smsInput, phones)

    if (!smsSent.ok) {
      // SMS failure is non-fatal: the email was already sent.
      result.errors.push(`SMS notification failed (non-fatal): ${smsSent.error}`)
    }
  }

  // Stamped only after Resend accepted the message. If this update fails the
  // representative gets one duplicate on the next run, which is the better way
  // round than never hearing about the tender at all.
  const { error: stampError } = await supabase
    .from('tenders_matched')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', pending.tender_id)

  if (stampError) {
    result.errors.push(
      `Email sent but notified_at could not be stamped, so a duplicate is ` +
        `possible next run: ${stampError.message}`,
    )
  }

  return result
}

function summarise(
  startedAt: Date,
  pending: number,
  tenders: TenderDraftResult[],
  errors: string[],
  model: string,
): DraftingRunSummary {
  const finishedAt = new Date()

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    model,
    emailConfigured: resendConfigured(),
    pending,
    tenders,
    totals: {
      documentsCreated: tenders.reduce(
        (sum, tender) => sum + tender.documentsCreated.length,
        0,
      ),
      emailsSent: tenders.filter((tender) => tender.emailed).length,
    },
    errors,
  }
}

/** Per tender run log, written to stdout for the platform log drain. */
export function formatDraftingSummary(summary: DraftingRunSummary): string {
  const lines: string[] = [
    `[draft-documents] run finished in ${summary.durationMs}ms ` +
      `(model ${summary.model}, email ${summary.emailConfigured ? 'configured' : 'NOT configured'})`,
    `[draft-documents] ${summary.pending} tender(s) pending:`,
  ]

  for (const tender of summary.tenders) {
    const name = tender.title ?? tender.tenderId
    const company = tender.companyName ?? 'unknown company'
    lines.push(
      `  - ${company} / ${name}: ${tender.documentsCreated.length} document(s), ` +
        `${tender.emailed ? `emailed ${tender.recipients} recipient(s)` : 'not emailed'}` +
        `${tender.skipped ? ` (${tender.skipped})` : ''}`,
    )
    for (const error of tender.errors) lines.push(`      error: ${error}`)
  }

  lines.push(
    `[draft-documents] totals: ${summary.totals.documentsCreated} document(s) ` +
      `created, ${summary.totals.emailsSent} email(s) sent`,
  )

  for (const error of summary.errors) lines.push(`[draft-documents] error: ${error}`)

  return lines.join('\n')
}
