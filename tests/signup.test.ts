/**
 * Signup validation and the domain gate's response parsing.
 *
 * These run on the client for fast feedback and again on the server, where they
 * are the ones that count, so a divergence here is a real hole.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  CALLBACK_ERRORS,
  companyExistsMessage,
  emailDomain,
  EMPTY_SIGN_UP,
  MIN_PASSWORD_LENGTH,
  parseSignupStatus,
  validateSignUp,
  type SignUpInput,
} from '@/lib/signup'

const valid: SignUpInput = {
  fullName: 'Brian Murutu',
  email: 'brian@yagwatech.com',
  password: 'a-long-enough-password',
  companyName: 'Yagwa Tech Solutions',
  industry: 'IT and software',
  sectors_of_interest: ['ICT and software'],
}

describe('emailDomain', () => {
  it('lowercases and trims', () => {
    assert.equal(emailDomain('  Brian@YagwaTech.COM '), 'yagwatech.com')
  })

  it('rejects an address with no @ or no dot in the domain', () => {
    assert.equal(emailDomain('brian'), null)
    assert.equal(emailDomain('brian@localhost'), null)
    assert.equal(emailDomain('a@b@c.com'), null)
  })
})

describe('validateSignUp', () => {
  it('accepts a complete input', () => {
    assert.deepEqual(validateSignUp(valid), {})
  })

  it('reports every empty field at once rather than one at a time', () => {
    const errors = validateSignUp(EMPTY_SIGN_UP)

    assert.ok(errors.fullName)
    assert.ok(errors.email)
    assert.ok(errors.password)
    assert.ok(errors.companyName)
    assert.ok(errors.industry)
    assert.ok(errors.sectors_of_interest)
  })

  it(`rejects a password under ${MIN_PASSWORD_LENGTH} characters`, () => {
    const errors = validateSignUp({ ...valid, password: 'a'.repeat(MIN_PASSWORD_LENGTH - 1) })

    assert.ok(errors.password)
    assert.deepEqual(validateSignUp({ ...valid, password: 'a'.repeat(MIN_PASSWORD_LENGTH) }), {})
  })

  it('treats whitespace-only names as empty', () => {
    assert.ok(validateSignUp({ ...valid, fullName: '   ' }).fullName)
    assert.ok(validateSignUp({ ...valid, companyName: '\t\n' }).companyName)
  })

  it('rejects an industry that is not on the list', () => {
    assert.ok(validateSignUp({ ...valid, industry: 'Cryptocurrency' }).industry)
  })

  it('rejects a sector that is not on the list', () => {
    assert.ok(
      validateSignUp({ ...valid, sectors_of_interest: ['Interplanetary freight'] })
        .sectors_of_interest,
    )
  })

  it('requires at least one sector, because it is the strongest matching signal', () => {
    assert.ok(validateSignUp({ ...valid, sectors_of_interest: [] }).sectors_of_interest)
  })
})

describe('parseSignupStatus', () => {
  it('parses the three simple statuses', () => {
    for (const status of ['available', 'invalid', 'not_company_domain'] as const) {
      assert.deepEqual(parseSignupStatus({ status }), { status })
    }
  })

  it('parses join_existing, tolerating a missing company name', () => {
    assert.deepEqual(parseSignupStatus({ status: 'join_existing', company_name: ' Acme ' }), {
      status: 'join_existing',
      companyName: 'Acme',
    })
    assert.deepEqual(parseSignupStatus({ status: 'join_existing' }), {
      status: 'join_existing',
      companyName: null,
    })
  })

  it('parses representative_exists', () => {
    assert.deepEqual(
      parseSignupStatus({
        status: 'representative_exists',
        company_name: 'Acme',
        representative_name: 'Ada',
        representative_email: 'ada@acme.com',
      }),
      {
        status: 'representative_exists',
        companyName: 'Acme',
        representativeName: 'Ada',
        representativeEmail: 'ada@acme.com',
      },
    )
  })

  it('rejects representative_exists with no email, since the message needs a contact', () => {
    assert.equal(
      parseSignupStatus({ status: 'representative_exists', company_name: 'Acme' }),
      null,
    )
  })

  it('rejects anything unrecognised rather than guessing', () => {
    for (const input of [null, undefined, 'available', 42, [], {}, { status: 'nope' }]) {
      assert.equal(parseSignupStatus(input), null)
    }
  })
})

describe('companyExistsMessage', () => {
  it('names the representative when a name is known', () => {
    const message = companyExistsMessage({
      status: 'representative_exists',
      companyName: 'Acme',
      representativeName: 'Ada',
      representativeEmail: 'ada@acme.com',
    })

    assert.match(message, /Ada \(ada@acme\.com\)/)
  })

  it('falls back to the address alone rather than leaving a dangling sentence', () => {
    const message = companyExistsMessage({
      status: 'representative_exists',
      companyName: null,
      representativeName: null,
      representativeEmail: 'ada@acme.com',
    })

    assert.match(message, /Ask ada@acme\.com for access/)
  })
})

describe('CALLBACK_ERRORS', () => {
  it('has a message for every ?error= the auth callback can redirect with', () => {
    for (const key of [
      'missing_code',
      'confirmation_failed',
      'domain_taken',
      'not_company_domain',
      'onboarding_failed',
    ]) {
      assert.ok(CALLBACK_ERRORS[key], `no message for ${key}`)
    }
  })
})
