/**
 * Score parsing, batching and the threshold.
 *
 * parseScores is the boundary where model output becomes database rows, so it is
 * treated as untrusted input and tested like one.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { RawTender } from '@/lib/tender-sources'
import {
  chunk,
  DEFAULT_THRESHOLD,
  MAX_BATCH_SIZE,
  MAX_SUMMARY_LENGTH,
  matchThreshold,
  parseScores,
  scoreBatch,
  scoreTendersForCompany,
  type ScoringCompany,
} from '@/lib/tender-matching'

function tender(n: number): RawTender {
  return {
    title: `Tender ${n}`,
    source_url: `https://example.test/t/${n}`,
    deadline: null,
    description: `Description ${n}`,
    procuring_entity: 'Entity',
  }
}

const batch = [tender(0), tender(1), tender(2)]

const company: ScoringCompany = {
  id: 'c1',
  name: 'Yagwa Tech Solutions',
  industry: 'IT and software',
  sectors_of_interest: ['ICT and software'],
  region: 'Nairobi City',
  company_size: '1-10',
}

/** A client whose completeJson returns the next canned payload in the list. */
function fakeClient(payloads: unknown[]) {
  const calls: { system: string; prompt: string }[] = []
  let index = 0

  return {
    calls,
    client: {
      provider: 'groq' as const,
      model: 'test-model',
      async completeJson(system: string, prompt: string) {
        calls.push({ system, prompt })

        return payloads[index++]
      },
    },
  }
}

describe('chunk', () => {
  it('splits into batches of at most the given size', () => {
    assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]])
  })

  it('returns no batches for an empty list', () => {
    assert.deepEqual(chunk([], 5), [])
  })

  it('returns one batch when the list is shorter than the size', () => {
    assert.deepEqual(chunk([1, 2], 10), [[1, 2]])
  })
})

describe('parseScores', () => {
  it('parses well formed scores and attaches the right tender', () => {
    const parsed = parseScores(
      { scores: [{ ref: 2, match_score: 88, summary: 'Good fit' }] },
      batch,
    )

    assert.equal(parsed.length, 1)
    assert.equal(parsed[0].tender.source_url, 'https://example.test/t/2')
    assert.equal(parsed[0].match_score, 88)
    assert.equal(parsed[0].summary, 'Good fit')
  })

  it('clamps a score into 0-100 and rounds it to an integer', () => {
    const parsed = parseScores(
      {
        scores: [
          { ref: 0, match_score: 250, summary: 'over' },
          { ref: 1, match_score: -40, summary: 'under' },
          { ref: 2, match_score: 61.6, summary: 'fractional' },
        ],
      },
      batch,
    )

    assert.deepEqual(
      parsed.map((score) => score.match_score),
      [100, 0, 62],
    )
  })

  it('drops a ref outside the batch rather than mis-attributing a score', () => {
    const parsed = parseScores(
      {
        scores: [
          { ref: 3, match_score: 90, summary: 'past the end' },
          { ref: -1, match_score: 90, summary: 'before the start' },
          { ref: 1.5, match_score: 90, summary: 'not an integer' },
        ],
      },
      batch,
    )

    assert.equal(parsed.length, 0)
  })

  it('keeps the first mention of a duplicated ref', () => {
    const parsed = parseScores(
      {
        scores: [
          { ref: 0, match_score: 10, summary: 'first' },
          { ref: 0, match_score: 90, summary: 'second' },
        ],
      },
      batch,
    )

    assert.equal(parsed.length, 1)
    assert.equal(parsed[0].summary, 'first')
  })

  it('rejects an entry with a missing or blank summary', () => {
    const parsed = parseScores(
      {
        scores: [
          { ref: 0, match_score: 70 },
          { ref: 1, match_score: 70, summary: '   ' },
          { ref: 2, match_score: 70, summary: 'kept' },
        ],
      },
      batch,
    )

    assert.deepEqual(
      parsed.map((score) => score.summary),
      ['kept'],
    )
  })

  it('rejects a non-numeric or NaN score', () => {
    const parsed = parseScores(
      {
        scores: [
          { ref: 0, match_score: '80' as unknown as number, summary: 'string' },
          { ref: 1, match_score: Number.NaN, summary: 'nan' },
        ],
      },
      batch,
    )

    assert.equal(parsed.length, 0)
  })

  it('truncates an overlong summary', () => {
    const parsed = parseScores(
      { scores: [{ ref: 0, match_score: 70, summary: 'x'.repeat(MAX_SUMMARY_LENGTH + 50) }] },
      batch,
    )

    assert.equal(parsed[0].summary.length, MAX_SUMMARY_LENGTH)
  })

  it('returns nothing for a payload that is not the expected shape', () => {
    for (const input of [null, undefined, 'scores', 42, [], {}, { scores: 'nope' }]) {
      assert.deepEqual(parseScores(input, batch), [])
    }
  })

  it('leaves an unscored tender out entirely rather than defaulting it to zero', () => {
    // A tender the model skipped must be retryable on the next run, not recorded
    // as irrelevant.
    const parsed = parseScores({ scores: [{ ref: 0, match_score: 70, summary: 'ok' }] }, batch)

    assert.equal(parsed.length, 1)
  })
})

describe('matchThreshold', () => {
  const original = process.env.TENDER_MATCH_THRESHOLD

  function withValue(value: string | undefined, run: () => void) {
    if (value === undefined) delete process.env.TENDER_MATCH_THRESHOLD
    else process.env.TENDER_MATCH_THRESHOLD = value

    try {
      run()
    } finally {
      if (original === undefined) delete process.env.TENDER_MATCH_THRESHOLD
      else process.env.TENDER_MATCH_THRESHOLD = original
    }
  }

  it('defaults when unset or blank', () => {
    withValue(undefined, () => assert.equal(matchThreshold(), DEFAULT_THRESHOLD))
    withValue('   ', () => assert.equal(matchThreshold(), DEFAULT_THRESHOLD))
  })

  it('reads a valid value', () => {
    withValue('75', () => assert.equal(matchThreshold(), 75))
    withValue('0', () => assert.equal(matchThreshold(), 0))
    withValue('100', () => assert.equal(matchThreshold(), 100))
  })

  it('falls back to the default on an out of range or unparseable value', () => {
    for (const bad of ['-1', '101', 'sixty', 'NaN', 'Infinity']) {
      withValue(bad, () => assert.equal(matchThreshold(), DEFAULT_THRESHOLD))
    }
  })
})

describe('scoreBatch', () => {
  it('sends the company profile and every tender in the prompt', async () => {
    const { client, calls } = fakeClient([
      { scores: [{ ref: 0, match_score: 80, summary: 'ok' }] },
    ])

    await scoreBatch(client, company, batch)

    assert.equal(calls.length, 1)
    assert.match(calls[0].prompt, /Yagwa Tech Solutions/)
    assert.match(calls[0].prompt, /ICT and software/)
    assert.match(calls[0].prompt, /Nairobi City/)

    for (const item of batch) {
      assert.ok(calls[0].prompt.includes(item.title), `${item.title} missing from prompt`)
    }
  })
})

describe('scoreTendersForCompany', () => {
  it('batches at MAX_BATCH_SIZE and merges the results', async () => {
    const many = Array.from({ length: MAX_BATCH_SIZE + 3 }, (_, i) => tender(i))
    const { client, calls } = fakeClient([
      { scores: [{ ref: 0, match_score: 80, summary: 'first batch' }] },
      { scores: [{ ref: 0, match_score: 70, summary: 'second batch' }] },
    ])

    const { scores, errors } = await scoreTendersForCompany(client, company, many)

    assert.equal(calls.length, 2)
    assert.equal(scores.length, 2)
    assert.deepEqual(errors, [])
  })

  it('records a failing batch as an error and keeps going', async () => {
    let call = 0
    const client = {
      provider: 'groq' as const,
      model: 'test-model',
      async completeJson() {
        call++
        if (call === 1) throw new Error('rate limited')
        return { scores: [{ ref: 0, match_score: 65, summary: 'second batch ok' }] }
      },
    }

    const many = Array.from({ length: MAX_BATCH_SIZE + 1 }, (_, i) => tender(i))
    const { scores, errors } = await scoreTendersForCompany(client, company, many)

    assert.deepEqual(errors, ['rate limited'])
    assert.equal(scores.length, 1)
  })
})
