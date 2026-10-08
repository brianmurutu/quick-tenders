'use server'

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { runDiscovery } from '@/lib/tender-discovery'
import { runDrafting } from '@/lib/tender-documents'

export type DiscoveryActionResult =
  | {
      ok: true
      tendersFetched: number
      matchedCount: number
      insertedCount: number
      topScore: number | null
      message: string
    }
  | { ok: false; error: string }

export type DraftingActionResult =
  | {
      ok: true
      documentsCreated: number
      emailsSent: number
      message: string
    }
  | { ok: false; error: string }

export type FullPipelineActionResult =
  | {
      ok: true
      tendersFetched: number
      matchedCount: number
      insertedCount: number
      documentsCreated: number
      message: string
    }
  | { ok: false; error: string }

export type TriggerDiscoveryOptions = {
  sourceIds?: string[]
  customSectors?: string[]
  forceRescore?: boolean
  nextRunDescription?: string
}

/**
 * Updates representative phone number for SMS notifications.
 */
export async function updateRepresentativePhoneAction(phone: string): Promise<{ ok: boolean; message: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, message: 'You must be signed in.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('representatives')
    .update({ phone_number: phone.trim() || null })
    .eq('id', user.id)

  if (error) {
    return { ok: false, message: error.message }
  }

  revalidatePath('/dashboard')
  return { ok: true, message: 'SMS notification phone number updated.' }
}

/**
 * Triggers on-demand tender discovery and AI profile matching.
 */
export async function triggerDiscoveryAction(
  options?: TriggerDiscoveryOptions,
): Promise<DiscoveryActionResult> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'You must be signed in to trigger discovery.' }
  }

  const admin = createAdminClient()
  const { data: rep } = await admin
    .from('representatives')
    .select('company_id, company:companies(id, name, industry, sectors_of_interest, region)')
    .eq('id', user.id)
    .maybeSingle()

  if (!rep?.company_id) {
    return { ok: false, error: 'Your account is not linked to an active company profile.' }
  }

  try {
    // Scoped to the caller company.
    const summary = await runDiscovery({
      sourceIds: options?.sourceIds,
      companyId: rep.company_id,
      customSectors: options?.customSectors,
      forceRescore: options?.forceRescore,
      nextRunDescription: options?.nextRunDescription,
    })

    const companyResult = summary.companies.find((c) => c.companyId === rep.company_id)
    const matchedCount = companyResult?.aboveThreshold ?? 0
    const insertedCount = companyResult?.inserted ?? 0
    const topScore = companyResult?.topScore ?? null

    // Trigger n8n automation workflow in the background
    fetch('https://automation-po7u65vp.truehost.biz/webhook/quicktender-discovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'dashboard_discovery_triggered',
        companyId: rep.company_id,
        matchedCount,
        insertedCount,
      }),
    }).catch(() => {})

    revalidatePath('/dashboard')

    return {
      ok: true,
      tendersFetched: summary.tendersFetched,
      matchedCount,
      insertedCount,
      topScore,
      message:
        insertedCount > 0
          ? `Discovered ${summary.tendersFetched} tenders. Matched and added ${insertedCount} high-compatibility tender${insertedCount === 1 ? '' : 's'} to your dashboard. Email and SMS alerts dispatched.`
          : matchedCount > 0
            ? `Scored ${summary.tendersFetched} tenders. Found ${matchedCount} match${matchedCount === 1 ? '' : 'es'} (already up to date). Notification sent.`
            : `Scored ${summary.tendersFetched} tenders from procurement sources. 0 new tenders exceeded the threshold for this selection. Summary notification sent.`,
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Discovery run failed. Please try again.',
    }
  }
}

/**
 * Triggers on-demand AI drafting of bid proposals, executive summaries, and cover letters.
 */
export async function triggerDraftingAction(): Promise<DraftingActionResult> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'You must be signed in to trigger drafting.' }
  }

  const admin = createAdminClient()
  const { data: rep } = await admin
    .from('representatives')
    .select('company_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!rep?.company_id) {
    return { ok: false, error: 'Your account is not linked to an active company profile.' }
  }

  try {
    // Scoped for the same reason as discovery above: drafting is two model calls,
    // two uploads and an email per match, and none of that should be spent on
    // another tenant because this representative pressed a button.
    const summary = await runDrafting({ limit: 10, companyId: rep.company_id })

    revalidatePath('/dashboard')

    const documentsCreated = summary.totals.documentsCreated
    const emailsSent = summary.totals.emailsSent

    return {
      ok: true,
      documentsCreated,
      emailsSent,
      message:
        documentsCreated > 0
          ? `Drafted ${documentsCreated} compliance document${documentsCreated === 1 ? '' : 's'} (.docx) with AI.`
          : 'All matched tenders already have up-to-date drafted documents.',
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Document drafting failed. Please try again.',
    }
  }
}

/**
 * Runs the entire AI automation pipeline: Discovery -> Scoring -> AI Drafting.
 */
export async function triggerFullPipelineAction(
  options?: TriggerDiscoveryOptions,
): Promise<FullPipelineActionResult> {
  const disc = await triggerDiscoveryAction(options)
  if (!disc.ok) return disc

  const draft = await triggerDraftingAction()
  if (!draft.ok) return draft

  revalidatePath('/dashboard')

  return {
    ok: true,
    tendersFetched: disc.tendersFetched,
    matchedCount: disc.matchedCount,
    insertedCount: disc.insertedCount,
    documentsCreated: draft.documentsCreated,
    message: `Full automation complete: Discovered ${disc.tendersFetched} tenders, matched ${disc.matchedCount}, and drafted ${draft.documentsCreated} Word (.docx) documents.`,
  }
}

/**
 * Resets matched tenders for the user's company (handy for live presentations to demo matching from scratch).
 */
export async function triggerResetMatchesAction(): Promise<{ ok: boolean; message: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, message: 'You must be signed in.' }
  }

  const admin = createAdminClient()
  const { data: rep } = await admin
    .from('representatives')
    .select('company_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!rep?.company_id) {
    return { ok: false, message: 'No company found.' }
  }

  const { error } = await admin
    .from('tenders_matched')
    .delete()
    .eq('company_id', rep.company_id)

  if (error) {
    return { ok: false, message: `Could not reset tenders: ${error.message}` }
  }

  revalidatePath('/dashboard')

  return {
    ok: true,
    message: 'Dashboard reset to empty state. Ready for fresh live demo matching.',
  }
}
