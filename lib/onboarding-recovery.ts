import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Robust fallback to finish onboarding if the Postgres RPC fails or user's session
 * needs recovery.
 */
export async function ensureUserOnboarded(userId: string): Promise<{ ok: boolean; companyId?: string; error?: string }> {
  try {
    const admin = createAdminClient()

    // 1. Check if representative already exists
    const { data: rep } = await admin
      .from('representatives')
      .select('id, company_id')
      .eq('id', userId)
      .maybeSingle()

    if (rep?.company_id) {
      return { ok: true, companyId: rep.company_id }
    }

    // 2. Fetch auth user record
    const { data: authUser, error: userError } = await admin.auth.admin.getUserById(userId)
    if (userError || !authUser?.user?.email) {
      return { ok: false, error: userError?.message || 'User not found in Auth system' }
    }

    const email = authUser.user.email.toLowerCase()
    const domain = email.split('@')[1]?.trim()
    if (!domain) return { ok: false, error: 'Invalid email domain' }

    const meta = (authUser.user.user_metadata || {}) as Record<string, unknown>
    const companyName = typeof meta.company_name === 'string' ? meta.company_name : domain
    const fullName = typeof meta.full_name === 'string' ? meta.full_name : ''
    const industry = typeof meta.industry === 'string' ? meta.industry : null
    const sectors = Array.isArray(meta.sectors_of_interest)
      ? (meta.sectors_of_interest.filter((s): s is string => typeof s === 'string'))
      : null

    // 3. Find or create company
    let { data: company } = await admin
      .from('companies')
      .select('id')
      .eq('domain', domain)
      .maybeSingle()

    if (!company) {
      const { data: newCompany, error: compError } = await admin
        .from('companies')
        .insert({
          name: companyName,
          domain: domain,
          industry: industry,
          sectors_of_interest: sectors,
        })
        .select('id')
        .maybeSingle()

      if (compError) {
        const { data: existingComp } = await admin
          .from('companies')
          .select('id')
          .eq('domain', domain)
          .maybeSingle()
        company = existingComp
      } else {
        company = newCompany
      }
    }

    if (!company?.id) {
      return { ok: false, error: 'Failed to create or link company' }
    }

    // 4. Create representative record
    const { error: repError } = await admin
      .from('representatives')
      .insert({
        id: userId,
        company_id: company.id,
        full_name: fullName,
        email: email,
      })

    if (repError && !repError.message.includes('duplicate')) {
      return { ok: false, error: repError.message }
    }

    return { ok: true, companyId: company.id }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error during onboarding recovery',
    }
  }
}
