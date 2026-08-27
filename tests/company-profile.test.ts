/**
 * Company matching profile validation, and the invariant that the signup form and
 * the onboarding form validate the same lists.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  COMPANY_SIZES,
  COUNTIES,
  EMPTY_COMPANY_PROFILE,
  INDUSTRIES,
  MAX_SECTORS,
  SECTORS,
  validateCompanyProfile,
  type CompanyProfile,
} from '@/lib/company-profile'

const valid: CompanyProfile = {
  industry: 'IT and software',
  sectors_of_interest: ['ICT and software', 'Telecommunications'],
  region: 'Nairobi City',
  company_size: '1-10',
}

describe('reference lists', () => {
  it('has all 47 counties, with no duplicates', () => {
    assert.equal(COUNTIES.length, 47)
    assert.equal(new Set(COUNTIES).size, 47)
  })

  it('uses the official county names tender notices are published against', () => {
    // "Nairobi" and "Taita Taveta" are the wrong forms; matching depends on these.
    assert.ok(COUNTIES.includes('Nairobi City'))
    assert.ok(COUNTIES.includes('Taita-Taveta'))
    assert.ok(!COUNTIES.includes('Nairobi' as (typeof COUNTIES)[number]))
  })

  it('has no duplicate industries, sectors or sizes', () => {
    assert.equal(new Set(INDUSTRIES).size, INDUSTRIES.length)
    assert.equal(new Set(SECTORS).size, SECTORS.length)
    assert.equal(new Set(COMPANY_SIZES).size, COMPANY_SIZES.length)
  })

  it('allows fewer sectors than exist, or the cap would be meaningless', () => {
    assert.ok(MAX_SECTORS < SECTORS.length)
  })
})

describe('validateCompanyProfile', () => {
  it('accepts a complete profile', () => {
    assert.deepEqual(validateCompanyProfile(valid), {})
  })

  it('reports every missing field on an empty profile', () => {
    const errors = validateCompanyProfile(EMPTY_COMPANY_PROFILE)

    assert.ok(errors.industry)
    assert.ok(errors.sectors_of_interest)
    assert.ok(errors.region)
    assert.ok(errors.company_size)
  })

  it('rejects values that are off the list rather than storing them', () => {
    assert.ok(validateCompanyProfile({ ...valid, industry: 'Cryptocurrency' }).industry)
    assert.ok(validateCompanyProfile({ ...valid, region: 'Nairobi' }).region)
    assert.ok(validateCompanyProfile({ ...valid, company_size: '2' }).company_size)
    assert.ok(
      validateCompanyProfile({ ...valid, sectors_of_interest: ['Space mining'] })
        .sectors_of_interest,
    )
  })

  it('accepts exactly MAX_SECTORS and rejects one more', () => {
    const atLimit = SECTORS.slice(0, MAX_SECTORS)
    const overLimit = SECTORS.slice(0, MAX_SECTORS + 1)

    assert.deepEqual(
      validateCompanyProfile({ ...valid, sectors_of_interest: [...atLimit] }),
      {},
    )
    assert.ok(
      validateCompanyProfile({ ...valid, sectors_of_interest: [...overLimit] })
        .sectors_of_interest,
    )
  })

  it('rejects a duplicated sector', () => {
    assert.ok(
      validateCompanyProfile({
        ...valid,
        sectors_of_interest: ['ICT and software', 'ICT and software'],
      }).sectors_of_interest,
    )
  })

  it('does not trim on the caller behalf, so callers must trim first', () => {
    // saveCompanyProfile and signUp both trim before validating. This documents
    // that validation itself is strict, which is why they have to.
    assert.ok(validateCompanyProfile({ ...valid, industry: ' IT and software ' }).industry)
  })
})
