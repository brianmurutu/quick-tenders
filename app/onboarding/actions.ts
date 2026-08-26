'use server'

import {
  validateCompanyProfile,
  type CompanyProfile,
  type CompanyProfileErrors,
} from '@/lib/company-profile'
import { normaliseKenyanPhone } from '@/lib/sms/textsms'
import { createClient } from '@/lib/supabase/server'

export type SaveProfileResult =
  | { status: 'invalid'; fieldErrors: CompanyProfileErrors }
  | { status: 'error'; message: string }
  | { status: 'saved' }

/**
 * Writes the matching profile onto the company of the signed-in representative,
 * and optionally saves a phone number to the representative row for SMS.
 *
 * Two things keep this honest beyond the checks here: RLS decides which row can
 * be touched, and the column level grants from migration 0004 mean only these
 * four columns plus name are writable by a representative at all. Even a request
 * that bypassed this action could not reach plan or trial_ends_at.
 */
export async function saveCompanyProfile(
  input: CompanyProfile,
  phoneNumber: string | null = null,
): Promise<SaveProfileResult> {
  const profile: CompanyProfile = {
    industry: input.industry.trim(),
    // Deduplicate before validating, so a repeated checkbox is not an error the
    // user cannot see the cause of.
    sectors_of_interest: Array.from(
      new Set(input.sectors_of_interest.map((sector) => sector.trim())),
    ),
    region: input.region.trim(),
    company_size: input.company_size.trim(),
  }

  const fieldErrors = validateCompanyProfile(profile)

  if (Object.keys(fieldErrors).length > 0) {
    return { status: 'invalid', fieldErrors }
  }

  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      status: 'error',
      message: 'Your session has expired. Sign in again and retry.',
    }
  }

  // RLS scopes this to the caller company, so no filter is needed to find it.
  const { data: company, error: lookupError } = await supabase
    .from('companies')
    .select('id')
    .limit(1)
    .maybeSingle()

  if (lookupError) {
    return {
      status: 'error',
      message: 'We could not load your company just now. Try again in a moment.',
    }
  }

  if (!company) {
    return {
      status: 'error',
      message:
        'Your account is not attached to a company yet. Get in touch and we will sort it out.',
    }
  }

  const { error: updateError } = await supabase
    .from('companies')
    .update({
      industry: profile.industry,
      sectors_of_interest: profile.sectors_of_interest,
      region: profile.region,
      company_size: profile.company_size,
    })
    .eq('id', company.id)

  if (updateError) {
    return {
      status: 'error',
      message: 'We could not save your profile just now. Try again in a moment.',
    }
  }

  // Save phone number to the representative row if provided and valid.
  if (phoneNumber) {
    const normalised = normaliseKenyanPhone(phoneNumber)

    if (normalised) {
      // Best effort: if this fails we still consider the profile saved.
      await supabase
        .from('representatives')
        .update({ phone_number: normalised })
        .eq('id', user.id)
    }
  }

  return { status: 'saved' }
}
