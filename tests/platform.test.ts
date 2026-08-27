/**
 * The remaining pure modules: trial windows, dashboard bucketing, redirect
 * safety, cron authorisation, Paystack helpers and AI provider selection.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  aiConfigHint,
  aiConfigured,
  aiDescription,
  aiModel,
  createAiClient,
  resolveAiProvider,
} from '@/lib/ai'
import { isCronAuthorised } from '@/lib/cron-auth'
import {
  isValidPlanAmountKes,
  isValidPlanAmountMinor,
  getSubscriptionPlan,
  paystackPlanAmountKes,
  SUBSCRIPTION_PLANS,
  verifyWebhookSignature,
} from '@/lib/paystack'
import {
  countByBucket,
  daysUntil,
  deadlinePhrase,
  filterByTab,
  formatDate,
  formatMatchScore,
  isoToday,
  isPastDeadline,
  isUrgent,
  isUuid,
  parseTab,
  STATUS_LABELS,
  tenderBucket,
  TENDER_TABS,
} from '@/lib/tender-status'
import { formatTrialDate, TRIAL_DAYS, trialState } from '@/lib/trial'
import { safeRelativePath } from '@/lib/url'

/** Restores an env var to whatever it was, whether that was unset or a value. */
function withEnv(values: Record<string, string | undefined>, run: () => void) {
  const original: Record<string, string | undefined> = {}

  for (const [key, value] of Object.entries(values)) {
    original[key] = process.env[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }

  try {
    run()
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

// ---------------------------------------------------------------------------
describe('trialState', () => {
  const now = new Date('2026-08-27T12:00:00Z')

  it('gives a paid plan unlimited access, whatever the dates say', () => {
    const state = trialState({ plan: 'paid', trial_ends_at: '2020-01-01T00:00:00Z' }, now)

    assert.equal(state.expired, false)
    assert.equal(state.onTrial, false)
  })

  it('reports days remaining, rounded up', () => {
    const state = trialState({ plan: 'trial', trial_ends_at: '2026-08-29T18:00:00Z' }, now)

    assert.equal(state.expired, false)
    assert.equal(state.onTrial, true)
    assert.equal(state.daysRemaining, 3)
  })

  it('expires the moment the window closes', () => {
    assert.equal(
      trialState({ plan: 'trial', trial_ends_at: '2026-08-27T12:00:00Z' }, now).expired,
      true,
    )
    assert.equal(
      trialState({ plan: 'trial', trial_ends_at: '2026-08-27T12:00:01Z' }, now).expired,
      false,
    )
  })

  it('never reports negative days remaining', () => {
    const state = trialState({ plan: 'trial', trial_ends_at: '2026-01-01T00:00:00Z' }, now)

    assert.equal(state.daysRemaining, 0)
    assert.ok(state.msRemaining < 0)
  })

  it('fails closed on an unparseable end date', () => {
    // Granting access because a timestamp could not be read is the wrong way round.
    const state = trialState({ plan: 'trial', trial_ends_at: 'not a date' }, now)

    assert.equal(state.expired, true)
    assert.equal(state.endsAt, null)
  })

  it('offers a trial of the advertised length', () => {
    assert.equal(TRIAL_DAYS, 3)
  })
})

describe('formatTrialDate', () => {
  it('formats in a stable locale, not the server one', () => {
    assert.equal(formatTrialDate(new Date('2026-08-26T00:00:00Z')), '26 August 2026')
  })

  it('does not print "Invalid Date" for a missing value', () => {
    assert.equal(formatTrialDate(null), 'an unknown date')
  })
})

// ---------------------------------------------------------------------------
describe('tenderBucket', () => {
  const today = '2026-08-27'

  it('keeps a submitted tender under Submitted even once it closes', () => {
    // You did the work; it should not vanish into Expired.
    assert.equal(tenderBucket({ status: 'submitted', deadline: '2020-01-01' }, today), 'submitted')
  })

  it('shows a closed new or reviewed tender as Expired', () => {
    assert.equal(tenderBucket({ status: 'new', deadline: '2026-08-26' }, today), 'expired')
    assert.equal(tenderBucket({ status: 'reviewed', deadline: '2026-08-26' }, today), 'expired')
  })

  it('keeps a tender closing today as still actionable', () => {
    assert.equal(tenderBucket({ status: 'new', deadline: today }, today), 'new')
  })

  it('treats a null deadline as open', () => {
    assert.equal(tenderBucket({ status: 'new', deadline: null }, today), 'new')
  })

  it('buckets are mutually exclusive, so the counts add up to the total', () => {
    const tenders = [
      { status: 'new' as const, deadline: '2026-09-01' },
      { status: 'reviewed' as const, deadline: '2026-09-01' },
      { status: 'submitted' as const, deadline: '2020-01-01' },
      { status: 'new' as const, deadline: '2020-01-01' },
      { status: 'expired' as const, deadline: null },
    ]

    const counts = countByBucket(tenders, today)

    assert.equal(counts.all, 5)
    assert.equal(counts.new + counts.reviewed + counts.submitted + counts.expired, counts.all)
    assert.deepEqual(
      { new: counts.new, reviewed: counts.reviewed, submitted: counts.submitted, expired: counts.expired },
      { new: 1, reviewed: 1, submitted: 1, expired: 2 },
    )
  })

  it('filterByTab agrees with countByBucket', () => {
    const tenders = [
      { status: 'new' as const, deadline: '2026-09-01' },
      { status: 'new' as const, deadline: '2020-01-01' },
    ]
    const counts = countByBucket(tenders, today)

    for (const { key } of TENDER_TABS) {
      assert.equal(filterByTab(tenders, key, today).length, counts[key], `tab ${key}`)
    }
  })
})

describe('parseTab', () => {
  it('accepts a known tab and rejects everything else', () => {
    assert.equal(parseTab('reviewed'), 'reviewed')
    assert.equal(parseTab(['expired']), 'expired')
    assert.equal(parseTab('nonsense'), 'all')
    assert.equal(parseTab(undefined), 'all')
  })
})

describe('tender date helpers', () => {
  const today = '2026-08-27'

  it('isPastDeadline treats null as not past', () => {
    assert.equal(isPastDeadline(null, today), false)
    assert.equal(isPastDeadline('2026-08-26', today), true)
    assert.equal(isPastDeadline(today, today), false)
  })

  it('daysUntil counts whole days, negative once passed', () => {
    assert.equal(daysUntil('2026-08-30', today), 3)
    assert.equal(daysUntil(today, today), 0)
    assert.equal(daysUntil('2026-08-20', today), -7)
    assert.equal(daysUntil(null, today), null)
  })

  it('deadlinePhrase reads naturally at every boundary', () => {
    assert.equal(deadlinePhrase(null, today), 'No closing date')
    assert.equal(deadlinePhrase(today, today), 'Closes today')
    assert.equal(deadlinePhrase('2026-08-28', today), 'Closes tomorrow')
    assert.equal(deadlinePhrase('2026-08-30', today), '3 days left')
    assert.equal(deadlinePhrase('2026-08-26', today), 'Closed 1 day ago')
    assert.equal(deadlinePhrase('2026-08-25', today), 'Closed 2 days ago')
  })

  it('isUrgent covers today through a week out, but not the past', () => {
    assert.equal(isUrgent(today, today), true)
    assert.equal(isUrgent('2026-09-03', today), true)
    assert.equal(isUrgent('2026-09-04', today), false)
    assert.equal(isUrgent('2026-08-26', today), false)
  })

  it('formatDate is locale stable and passes bad input through', () => {
    assert.equal(formatDate('2026-10-15'), '15 October 2026')
    assert.equal(formatDate(null), 'Not stated')
    assert.equal(formatDate('nonsense'), 'nonsense')
  })

  it('isoToday is a plain calendar date', () => {
    assert.match(isoToday(new Date('2026-08-27T23:30:00Z')), /^2026-08-27$/)
  })

  it('formatMatchScore rounds and handles no score', () => {
    assert.equal(formatMatchScore(87.4), '87%')
    assert.equal(formatMatchScore(null), 'Not scored')
  })

  it('has a label for every stored status', () => {
    for (const status of ['new', 'reviewed', 'submitted', 'expired'] as const) {
      assert.ok(STATUS_LABELS[status])
    }
  })
})

describe('isUuid', () => {
  it('accepts a uuid in either case', () => {
    assert.ok(isUuid('e938dfb9-2965-443d-b179-0c60c4123234'))
    assert.ok(isUuid('E938DFB9-2965-443D-B179-0C60C4123234'))
  })

  it('rejects anything Postgres would raise on', () => {
    for (const value of ['', 'abc', '123', 'e938dfb9-2965-443d-b179', "1' or '1'='1"]) {
      assert.ok(!isUuid(value), `accepted ${value}`)
    }
  })
})

// ---------------------------------------------------------------------------
describe('safeRelativePath', () => {
  it('allows a same-origin relative path', () => {
    assert.equal(safeRelativePath('/dashboard'), '/dashboard')
    assert.equal(safeRelativePath('/dashboard?tab=new'), '/dashboard?tab=new')
  })

  it('refuses anything that leaves the origin', () => {
    for (const raw of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      'javascript:alert(1)',
      'dashboard',
    ]) {
      assert.equal(safeRelativePath(raw, '/fallback'), '/fallback', `allowed ${raw}`)
    }
  })

  it('falls back for empty input', () => {
    assert.equal(safeRelativePath(null), '/')
    assert.equal(safeRelativePath(undefined, '/x'), '/x')
    assert.equal(safeRelativePath('', '/x'), '/x')
  })
})

// ---------------------------------------------------------------------------
describe('isCronAuthorised', () => {
  function request(headers: Record<string, string>) {
    return { headers: new Headers(headers) } as unknown as Parameters<typeof isCronAuthorised>[0]
  }

  it('fails closed when CRON_SECRET is unset', () => {
    // An unset secret must shut the endpoint, not open it.
    withEnv({ CRON_SECRET: undefined }, () => {
      assert.equal(isCronAuthorised(request({ authorization: 'Bearer anything' })), false)
    })
  })

  it('accepts the secret as a bearer token or X-Cron-Secret', () => {
    withEnv({ CRON_SECRET: 's3cret' }, () => {
      assert.equal(isCronAuthorised(request({ authorization: 'Bearer s3cret' })), true)
      assert.equal(isCronAuthorised(request({ 'x-cron-secret': 's3cret' })), true)
    })
  })

  it('rejects a wrong, absent or differently-lengthed secret', () => {
    withEnv({ CRON_SECRET: 's3cret' }, () => {
      assert.equal(isCronAuthorised(request({ authorization: 'Bearer wrong!' })), false)
      assert.equal(isCronAuthorised(request({ authorization: 'Bearer s3cre' })), false)
      assert.equal(isCronAuthorised(request({ authorization: 's3cret' })), false)
      assert.equal(isCronAuthorised(request({})), false)
    })
  })
})

// ---------------------------------------------------------------------------
describe('Paystack helpers', () => {
  it('only accepts an amount that matches a real plan', () => {
    for (const plan of SUBSCRIPTION_PLANS) {
      assert.ok(isValidPlanAmountKes(plan.amountKes))
      assert.ok(isValidPlanAmountMinor(plan.amountKes * 100))
    }

    // A webhook claiming an arbitrary amount must not be honoured.
    assert.ok(!isValidPlanAmountKes(1999))
    assert.ok(!isValidPlanAmountMinor(1999))
    assert.ok(!isValidPlanAmountMinor(2000), 'KES is charged in cents, not whole units')
  })

  it('falls back to the first plan for an unknown id', () => {
    assert.equal(getSubscriptionPlan('pro').id, 'pro')
    assert.equal(getSubscriptionPlan('nonexistent').id, SUBSCRIPTION_PLANS[0].id)
    assert.equal(getSubscriptionPlan(null).id, SUBSCRIPTION_PLANS[0].id)
  })

  it('defaults the plan amount when the env var is missing or nonsense', () => {
    withEnv({ PAYSTACK_PLAN_AMOUNT_KES: undefined }, () =>
      assert.equal(paystackPlanAmountKes(), 2000),
    )
    withEnv({ PAYSTACK_PLAN_AMOUNT_KES: 'free' }, () =>
      assert.equal(paystackPlanAmountKes(), 2000),
    )
    withEnv({ PAYSTACK_PLAN_AMOUNT_KES: '-5' }, () =>
      assert.equal(paystackPlanAmountKes(), 2000),
    )
    withEnv({ PAYSTACK_PLAN_AMOUNT_KES: '3500' }, () =>
      assert.equal(paystackPlanAmountKes(), 3500),
    )
  })

  it('rejects a webhook signature when no secret key is set', async () => {
    const key = process.env.PAYSTACK_SECRET_KEY
    try {
      delete process.env.PAYSTACK_SECRET_KEY
      assert.equal(await verifyWebhookSignature('{}', 'deadbeef'), false)
    } finally {
      if (key === undefined) delete process.env.PAYSTACK_SECRET_KEY
      else process.env.PAYSTACK_SECRET_KEY = key
    }
  })

  it('verifies a genuine HMAC-SHA512 signature and rejects a tampered body', async () => {
    const secret = 'sk_test_abc123'
    const body = '{"event":"charge.success"}'

    const { createHmac } = await import('node:crypto')
    const signature = createHmac('sha512', secret).update(body).digest('hex')

    const key = process.env.PAYSTACK_SECRET_KEY
    try {
      process.env.PAYSTACK_SECRET_KEY = secret

      assert.equal(await verifyWebhookSignature(body, signature), true)
      assert.equal(await verifyWebhookSignature(body, signature.toUpperCase()), true)
      assert.equal(await verifyWebhookSignature(`${body} `, signature), false)
      assert.equal(await verifyWebhookSignature(body, 'deadbeef'), false)
    } finally {
      if (key === undefined) delete process.env.PAYSTACK_SECRET_KEY
      else process.env.PAYSTACK_SECRET_KEY = key
    }
  })
})

// ---------------------------------------------------------------------------
describe('AI provider selection', () => {
  const cleared = {
    AI_PROVIDER: undefined,
    GROQ_API_KEY: undefined,
    XAI_API_KEY: undefined,
    GROQ_MODEL: undefined,
    GROK_MODEL: undefined,
  }

  it('prefers Groq when both keys are present', () => {
    withEnv({ ...cleared, GROQ_API_KEY: 'g', XAI_API_KEY: 'x' }, () => {
      assert.equal(resolveAiProvider().id, 'groq')
      assert.equal(createAiClient().provider, 'groq')
    })
  })

  it('uses xAI when only its key is present', () => {
    withEnv({ ...cleared, XAI_API_KEY: 'x' }, () => {
      assert.equal(resolveAiProvider().id, 'xai')
      assert.equal(aiModel(), 'grok-4.6')
    })
  })

  it('honours an explicit AI_PROVIDER pin over key order', () => {
    withEnv({ ...cleared, AI_PROVIDER: 'xai', GROQ_API_KEY: 'g', XAI_API_KEY: 'x' }, () => {
      assert.equal(resolveAiProvider().id, 'xai')
    })
  })

  it('reads the per-provider model override', () => {
    withEnv({ ...cleared, GROQ_API_KEY: 'g', GROQ_MODEL: 'openai/gpt-oss-120b' }, () => {
      assert.equal(aiModel(), 'openai/gpt-oss-120b')
      assert.equal(aiDescription(), 'Groq / openai/gpt-oss-120b')
    })
  })

  it('reports unconfigured rather than throwing from aiConfigured', () => {
    withEnv(cleared, () => {
      assert.equal(aiConfigured(), false)
      assert.match(aiConfigHint(), /GROQ_API_KEY/)
      assert.match(aiConfigHint(), /XAI_API_KEY/)
      assert.throws(() => createAiClient(), /No AI provider is configured/)
    })
  })

  it('names a bad AI_PROVIDER value instead of failing obscurely', () => {
    withEnv({ ...cleared, AI_PROVIDER: 'openai', GROQ_API_KEY: 'g' }, () => {
      assert.throws(() => resolveAiProvider(), /Unknown AI_PROVIDER "openai"/)
    })
  })

  it('explains a pin whose key is missing', () => {
    withEnv({ ...cleared, AI_PROVIDER: 'groq' }, () => {
      assert.match(aiConfigHint(), /GROQ_API_KEY is not set/)
    })
  })
})
