'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { isUuid } from '@/lib/tender-status'

export type StatusUpdateResult =
  | { ok: true; status: 'reviewed' | 'submitted' }
  | { ok: false; error: string }

/**
 * Both actions rely on RLS for authorisation rather than re-checking the company
 * themselves: the update policy from 0001 restricts the row to the caller
 * company, so an id belonging to somebody else matches nothing and the update
 * affects zero rows. That is the correct outcome and needs no extra query.
 */

/**
 * Moves a tender from new to reviewed the first time its detail page is opened.
 *
 * Guarded on the current status in the WHERE clause, not read-then-write, so a
 * tender already marked submitted cannot be dragged back to reviewed by a stray
 * call, and two simultaneous opens cannot fight.
 */
export async function markTenderReviewed(tenderId: string): Promise<StatusUpdateResult> {
  if (!isUuid(tenderId)) return { ok: false, error: 'Unknown tender' }

  const supabase = createClient()

  const { error } = await supabase
    .from('tenders_matched')
    .update({ status: 'reviewed' })
    .eq('id', tenderId)
    .eq('status', 'new')

  if (error) return { ok: false, error: error.message }

  // The list badge and the tab counts both change, so refresh each.
  revalidatePath('/dashboard')
  revalidatePath(`/dashboard/tenders/${tenderId}`)

  return { ok: true, status: 'reviewed' }
}

/** The "Mark as submitted" button. */
export async function markTenderSubmitted(tenderId: string): Promise<StatusUpdateResult> {
  if (!isUuid(tenderId)) return { ok: false, error: 'Unknown tender' }

  const supabase = createClient()

  const { data, error } = await supabase
    .from('tenders_matched')
    .update({ status: 'submitted' })
    .eq('id', tenderId)
    .select('id')

  if (error) return { ok: false, error: error.message }

  // Zero rows means the tender is not this company, or no longer exists.
  if (!data || data.length === 0) {
    return { ok: false, error: 'That tender could not be updated.' }
  }

  revalidatePath('/dashboard')
  revalidatePath(`/dashboard/tenders/${tenderId}`)

  return { ok: true, status: 'submitted' }
}
