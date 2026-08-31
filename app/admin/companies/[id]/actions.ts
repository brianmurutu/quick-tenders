'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Guard helper
// ---------------------------------------------------------------------------

/**
 * Verifies the calling session is an admin.
 *
 * This is a belt-and-suspenders check: the RPC functions themselves call
 * is_admin() and raise a Postgres exception if the caller is not an admin, so
 * even if this guard were bypassed somehow the database would still refuse.
 *
 * Throws if the user is not signed in or not in admin_users.
 */
async function assertAdmin() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (!adminRow) throw new Error('Not an admin')

  return { supabase, user }
}

// ---------------------------------------------------------------------------
// Extend trial
// ---------------------------------------------------------------------------

export type ExtendTrialState = {
  ok: boolean
  message: string
  newEndsAt?: string
}

/**
 * Server Action: extend a company's trial by `days` (1–365).
 *
 * Calls the SECURITY DEFINER RPC `admin_extend_trial`, which enforces its own
 * is_admin() check and bounds-checks the day count, so validation here is
 * purely for a helpful early error message before the DB round-trip.
 */
export async function extendTrialAction(
  companyId: string,
  _prevState: ExtendTrialState,
  formData: FormData,
): Promise<ExtendTrialState> {
  const daysRaw = formData.get('days')
  const days = parseInt(String(daysRaw ?? ''), 10)

  if (!Number.isFinite(days) || days < 1 || days > 365) {
    return { ok: false, message: 'Days must be a whole number between 1 and 365.' }
  }

  try {
    const { supabase } = await assertAdmin()

    const { data, error } = await supabase.rpc('admin_extend_trial', {
      p_company_id: companyId,
      p_days: days,
    })

    if (error) return { ok: false, message: error.message }

    revalidatePath(`/admin/companies/${companyId}`)
    revalidatePath('/admin/companies')

    return {
      ok: true,
      message: `Trial extended by ${days} day${days === 1 ? '' : 's'}.`,
      newEndsAt: data as string,
    }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
}

// ---------------------------------------------------------------------------
// Set plan
// ---------------------------------------------------------------------------

export type SetPlanState = {
  ok: boolean
  message: string
  newPlan?: string
}

/**
 * Server Action: set a company's plan to 'trial' or 'paid'.
 *
 * Calls the SECURITY DEFINER RPC `admin_set_company_plan`, which enforces
 * is_admin() and whitelists the plan value.
 */
export async function setPlanAction(
  companyId: string,
  _prevState: SetPlanState,
  formData: FormData,
): Promise<SetPlanState> {
  const plan = String(formData.get('plan') ?? '')

  if (plan !== 'trial' && plan !== 'paid') {
    return { ok: false, message: 'Plan must be "trial" or "paid".' }
  }

  try {
    const { supabase } = await assertAdmin()

    const { data, error } = await supabase.rpc('admin_set_company_plan', {
      p_company_id: companyId,
      p_plan: plan,
    })

    if (error) return { ok: false, message: error.message }

    revalidatePath(`/admin/companies/${companyId}`)
    revalidatePath('/admin/companies')

    return {
      ok: true,
      message: `Plan set to "${data}".`,
      newPlan: data as string,
    }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
}
