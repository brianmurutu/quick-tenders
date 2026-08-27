/**
 * The notification email, the Resend sender rules, and SMS number normalisation.
 *
 * Nothing here sends anything: buildTenderEmail is a pure function and the sender
 * helpers only read configuration.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildTenderEmail,
  escapeHtml,
  reviewUrl,
  type TenderEmailInput,
} from '@/lib/email/tender-notification'
import {
  RESEND_TEST_SENDER,
  resendConfigHint,
  resendConfigured,
  senderDomain,
  senderIsUnverifiable,
} from '@/lib/email/resend'
import { normaliseKenyanPhone, textSmsConfigured } from '@/lib/sms/textsms'
import { buildTenderSmsText } from '@/lib/sms/tender-notification-sms'

const input: TenderEmailInput = {
  tenderId: 'a1b2c3',
  title: 'Municipal water infrastructure upgrade',
  procuringEntity: 'Nakuru County Water and Sanitation',
  deadline: '2099-09-15',
  matchScore: 87,
  summary: 'Pipework and metering, matching your water and sanitation sector.',
  sourceUrl: 'https://example.test/tenders/water',
  companyName: 'Yagwa Tech Solutions',
  representativeName: 'Brian',
  documentLabels: ['Cover letter', 'Technical proposal skeleton'],
}

describe('escapeHtml', () => {
  it('escapes the five characters that matter in an HTML document', () => {
    assert.equal(
      escapeHtml(`<script>&"'`),
      '&lt;script&gt;&amp;&quot;&#39;',
    )
  })

  it('escapes the ampersand first, so entities are not double broken', () => {
    assert.equal(escapeHtml('&lt;'), '&amp;lt;')
  })
})

describe('reviewUrl', () => {
  it('points at the dashboard route for one tender', () => {
    assert.match(reviewUrl('abc'), /\/dashboard\/tenders\/abc$/)
  })

  it('encodes the id, since it is interpolated into a URL', () => {
    assert.match(reviewUrl('a/b?c'), /a%2Fb%3Fc$/)
  })
})

describe('buildTenderEmail', () => {
  const email = buildTenderEmail(input)

  it('names the tender in the subject', () => {
    assert.equal(email.subject, 'New tender match: Municipal water infrastructure upgrade')
  })

  it('greets the representative by name when one is known', () => {
    assert.match(email.text, /^Hello Brian,/)
    assert.match(buildTenderEmail({ ...input, representativeName: null }).text, /^Hello,/)
  })

  it('includes the tender details, the match score and the review link', () => {
    for (const part of [
      'Municipal water infrastructure upgrade',
      'Nakuru County Water and Sanitation',
      '87% match',
      '/dashboard/tenders/a1b2c3',
    ]) {
      assert.ok(email.text.includes(part), `text is missing ${part}`)
      assert.ok(email.html.includes(part), `html is missing ${part}`)
    }
  })

  it('lists the drafted documents, or says they are still being drafted', () => {
    assert.match(email.text, /Drafted for you: Cover letter, Technical proposal skeleton\./)
    assert.match(
      buildTenderEmail({ ...input, documentLabels: [] }).text,
      /Documents are still being drafted\./,
    )
  })

  it('always carries the "these are drafts" warning', () => {
    assert.match(email.text, /These are drafts/)
    assert.match(email.html, /These are drafts/)
  })

  it('escapes a tender title from an untrusted source', () => {
    // Titles come from scraped and imported third party pages.
    const hostile = buildTenderEmail({
      ...input,
      title: '<img src=x onerror=alert(1)>',
      procuringEntity: '"><script>alert(1)</script>',
    })

    assert.ok(!hostile.html.includes('<img src=x'))
    assert.ok(!hostile.html.includes('<script>alert(1)</script>'))
    assert.match(hostile.html, /&lt;img src=x/)
  })

  it('describes the deadline relative to now, and marks a closed one', () => {
    assert.match(buildTenderEmail(input).text, /days away/)
    assert.match(
      buildTenderEmail({ ...input, deadline: '2020-01-01' }).text,
      /already closed/,
    )
    assert.match(buildTenderEmail({ ...input, deadline: null }).text, /not stated/)
  })

  it('passes an unparseable deadline through rather than showing "Invalid Date"', () => {
    assert.match(buildTenderEmail({ ...input, deadline: 'sometime' }).text, /sometime/)
  })

  it('omits the match row when no score was recorded', () => {
    const noScore = buildTenderEmail({ ...input, matchScore: null })

    assert.doesNotMatch(noScore.text, /% match/)
    assert.doesNotMatch(noScore.html, />Match</)
  })

  it('produces a complete HTML document', () => {
    assert.match(email.html, /^<!doctype html>/)
    assert.match(email.html, /<\/html>$/)
  })
})

describe('Resend sender rules', () => {
  it('extracts the domain from both sender forms', () => {
    assert.equal(senderDomain('tenders@quicktenders.co.ke'), 'quicktenders.co.ke')
    assert.equal(senderDomain('Quick Tenders <tenders@Quicktenders.CO.KE>'), 'quicktenders.co.ke')
    assert.equal(senderDomain('not an address'), null)
  })

  it('flags a consumer mailbox, which Resend can never verify', () => {
    // This is the bug that silently broke every send: gmail.com is not a domain
    // anybody signing up can add DNS records to.
    assert.ok(senderIsUnverifiable('quicktenders.ke@gmail.com'))
    assert.ok(senderIsUnverifiable('Quick Tenders <someone@outlook.com>'))
    assert.ok(!senderIsUnverifiable('tenders@quicktenders.co.ke'))
  })

  it('offers a test sender on a domain Resend owns', () => {
    assert.match(RESEND_TEST_SENDER, /@resend\.dev>?$/)
  })

  it('reports which configuration values are missing', () => {
    const key = process.env.RESEND_API_KEY
    const from = process.env.RESEND_FROM_EMAIL

    try {
      delete process.env.RESEND_API_KEY
      delete process.env.RESEND_FROM_EMAIL

      assert.equal(resendConfigured(), false)
      assert.match(resendConfigHint(), /RESEND_API_KEY and RESEND_FROM_EMAIL/)

      process.env.RESEND_API_KEY = 'k'
      process.env.RESEND_FROM_EMAIL = 'a@b.com'

      assert.equal(resendConfigured(), true)
      assert.equal(resendConfigHint(), 'Email is configured')
    } finally {
      if (key === undefined) delete process.env.RESEND_API_KEY
      else process.env.RESEND_API_KEY = key
      if (from === undefined) delete process.env.RESEND_FROM_EMAIL
      else process.env.RESEND_FROM_EMAIL = from
    }
  })
})

describe('normaliseKenyanPhone', () => {
  it('accepts every local and international form and returns 254XXXXXXXXX', () => {
    for (const raw of [
      '0712345678',
      '+254712345678',
      '254712345678',
      '0712 345 678',
      '+254 712 345 678',
      '(0712) 345-678',
    ]) {
      assert.equal(normaliseKenyanPhone(raw), '254712345678', `failed on ${raw}`)
    }
  })

  it('handles the 01 range', () => {
    assert.equal(normaliseKenyanPhone('0112345678'), '254112345678')
  })

  it('rejects anything that is not a Kenyan mobile number', () => {
    for (const raw of ['', '123', '0812345678', '0612345678', '+1 555 0100', 'abc']) {
      assert.equal(normaliseKenyanPhone(raw), null, `accepted ${raw}`)
    }
  })
})

describe('textSmsConfigured', () => {
  it('needs both the key and the sender id', () => {
    const key = process.env.TEXTSMS_API_KEY
    const sender = process.env.TEXTSMS_SENDER_ID

    try {
      delete process.env.TEXTSMS_API_KEY
      delete process.env.TEXTSMS_SENDER_ID
      assert.equal(textSmsConfigured(), false)

      process.env.TEXTSMS_API_KEY = 'k'
      assert.equal(textSmsConfigured(), false)

      process.env.TEXTSMS_SENDER_ID = 's'
      assert.equal(textSmsConfigured(), true)
    } finally {
      if (key === undefined) delete process.env.TEXTSMS_API_KEY
      else process.env.TEXTSMS_API_KEY = key
      if (sender === undefined) delete process.env.TEXTSMS_SENDER_ID
      else process.env.TEXTSMS_SENDER_ID = sender
    }
  })
})

describe('buildTenderSmsText', () => {
  it('fits a single SMS part, even with a very long title', () => {
    const message = buildTenderSmsText({
      tenderId: 'a1b2c3',
      title:
        'Supply, Installation and Configuration of Enterprise Cloud Infrastructure and Network Security Solutions',
      deadline: '2099-09-15',
      companyName: 'Yagwa Tech Solutions',
    })

    assert.ok(message.length <= 160, `message is ${message.length} characters`)
    assert.match(message, /^QuickTenders: /)
    assert.match(message, /\/dashboard\/tenders\/a1b2c3/)
  })

  it('describes a closing date relatively, and marks a closed one', () => {
    const base = { tenderId: 'x', title: 'T', companyName: 'C' }

    assert.match(buildTenderSmsText({ ...base, deadline: '2020-01-01' }), /closed/)
    assert.match(buildTenderSmsText({ ...base, deadline: '2099-01-01' }), /\d+d\)/)
  })

  it('omits the closing part entirely when no deadline is known', () => {
    const message = buildTenderSmsText({
      tenderId: 'x',
      title: 'T',
      deadline: null,
      companyName: 'C',
    })

    assert.doesNotMatch(message, /Closes/)
  })

  it('falls back to a generic title rather than sending "null"', () => {
    const message = buildTenderSmsText({
      tenderId: 'x',
      title: null,
      deadline: null,
      companyName: null,
    })

    assert.match(message, /New tender/)
    assert.doesNotMatch(message, /null/)
  })
})
