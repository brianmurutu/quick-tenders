/**
 * Source normalisation and the fetch fan-out.
 *
 * The fan-out has three properties the pipeline depends on: one failing source
 * never fails the run, every source appears in the summary, and duplicates
 * collapse across sources. Each is tested with fake adapters.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  ALL_SOURCES,
  dropExpired,
  enabledSourceIds,
  fetchAllTenders,
  mockSource,
  normaliseSourceUrl,
  normaliseTender,
  normaliseTenders,
  parseDeadline,
  stripHtml,
  type RawTender,
  type TenderSource,
} from '@/lib/tender-sources'

function source(
  id: string,
  tenders: Partial<RawTender>[],
  overrides: Partial<TenderSource> = {},
): TenderSource {
  return {
    id,
    label: `Source ${id}`,
    isConfigured: () => true,
    async fetchTenders() {
      return tenders as RawTender[]
    },
    ...overrides,
  }
}

function row(url: string, title = 'A tender'): Partial<RawTender> {
  return {
    title,
    source_url: url,
    description: 'Some description',
    procuring_entity: 'Entity',
    deadline: null,
  }
}

describe('parseDeadline', () => {
  it('accepts ISO dates and ISO timestamps', () => {
    assert.equal(parseDeadline('2026-09-15'), '2026-09-15')
    assert.equal(parseDeadline('2026-09-15T14:30:00Z'), '2026-09-15')
    assert.equal(parseDeadline('2026-09-15 14:30'), '2026-09-15')
  })

  it('reads ambiguous slash dates as day-first, the local convention', () => {
    assert.equal(parseDeadline('15/09/2026'), '2026-09-15')
    assert.equal(parseDeadline('5/9/2026'), '2026-09-05')
    assert.equal(parseDeadline('15.09.2026'), '2026-09-15')
    assert.equal(parseDeadline('15-09-2026'), '2026-09-15')
  })

  it('rejects an impossible date rather than rolling it over', () => {
    // A wrong deadline is worse than a missing one.
    assert.equal(parseDeadline('2026-02-31'), null)
    assert.equal(parseDeadline('31/02/2026'), null)
    assert.equal(parseDeadline('2026-13-01'), null)
  })

  it('returns null for empty and unrecognised input', () => {
    for (const input of [null, undefined, '', '   ', 'next Friday', '15 Sept 2026']) {
      assert.equal(parseDeadline(input), null)
    }
  })
})

describe('normaliseSourceUrl', () => {
  it('accepts http and https', () => {
    assert.equal(normaliseSourceUrl('https://example.test/a'), 'https://example.test/a')
    assert.equal(normaliseSourceUrl('  http://example.test/b  '), 'http://example.test/b')
  })

  it('rejects other protocols, since the value is rendered as a link', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'ftp://x/y']) {
      assert.equal(normaliseSourceUrl(url), null)
    }
  })

  it('rejects unparseable and empty values', () => {
    for (const url of [null, undefined, '', 'not a url', '/relative/path']) {
      assert.equal(normaliseSourceUrl(url), null)
    }
  })
})

describe('normaliseTender', () => {
  it('collapses whitespace in the title and description', () => {
    const tender = normaliseTender(
      { title: '  Supply   of\n\ngoods ', source_url: 'https://x.test/1', description: 'a\t\tb' },
      'Fallback',
    )

    assert.equal(tender?.title, 'Supply of goods')
    assert.equal(tender?.description, 'a b')
  })

  it('rejects a row with no title or no usable URL', () => {
    assert.equal(normaliseTender({ source_url: 'https://x.test/1' }, 'F'), null)
    assert.equal(normaliseTender({ title: 'T' }, 'F'), null)
    assert.equal(normaliseTender({ title: 'T', source_url: 'javascript:x' }, 'F'), null)
  })

  it('falls back to the source label when no procuring entity is given', () => {
    const tender = normaliseTender({ title: 'T', source_url: 'https://x.test/1' }, 'Fallback')

    assert.equal(tender?.procuring_entity, 'Fallback')
  })

  it('truncates a very long description', () => {
    const tender = normaliseTender(
      { title: 'T', source_url: 'https://x.test/1', description: 'x'.repeat(5000) },
      'F',
    )

    assert.equal(tender?.description.length, 4000)
  })
})

describe('normaliseTenders', () => {
  it('counts unusable rows as discarded instead of throwing', () => {
    const { tenders, discarded } = normaliseTenders(
      [row('https://x.test/1'), { title: 'no url' }, row('https://x.test/2')],
      'F',
    )

    assert.equal(tenders.length, 2)
    assert.equal(discarded, 1)
  })

  it('drops a duplicate source_url within the batch', () => {
    const { tenders, discarded } = normaliseTenders(
      [row('https://x.test/1'), row('https://x.test/1')],
      'F',
    )

    assert.equal(tenders.length, 1)
    assert.equal(discarded, 1)
  })
})

describe('stripHtml', () => {
  it('removes tags and decodes entities', () => {
    assert.equal(stripHtml('<p>Water &amp; sanitation</p>'), 'Water & sanitation')
    assert.equal(stripHtml('a&nbsp;b'), 'a b')
    assert.equal(stripHtml('It&#8217;s here'), "It's here")
  })

  it('removes script and style bodies, not just their tags', () => {
    assert.equal(stripHtml('<script>alert(1)</script>ok'), 'ok')
    assert.equal(stripHtml('<style>p{color:red}</style>ok'), 'ok')
  })

  it('decodes the ampersand last, so &amp;lt; does not become a tag delimiter', () => {
    assert.equal(stripHtml('&amp;lt;b&amp;gt;'), '&lt;b&gt;')
  })
})

describe('dropExpired', () => {
  const now = new Date('2026-08-27T10:00:00Z')

  it('keeps today, keeps the future, drops the past', () => {
    const tenders = [
      { ...row('https://x.test/past'), deadline: '2026-08-26' },
      { ...row('https://x.test/today'), deadline: '2026-08-27' },
      { ...row('https://x.test/future'), deadline: '2026-09-01' },
    ] as RawTender[]

    const kept = dropExpired(tenders, now).map((t) => t.deadline)

    assert.deepEqual(kept, ['2026-08-27', '2026-09-01'])
  })

  it('keeps a null deadline, since unknown is not the same as expired', () => {
    const tenders = [{ ...row('https://x.test/none'), deadline: null }] as RawTender[]

    assert.equal(dropExpired(tenders, now).length, 1)
  })
})

describe('enabledSourceIds', () => {
  const originalSources = process.env.TENDER_SOURCES
  const originalNodeEnv = process.env.NODE_ENV

  /**
   * NODE_ENV is typed as a literal union, so assigning to it needs a cast. Node 24
   * rejects Object.defineProperty on process.env, so plain assignment it is.
   */
  const mutableEnv = process.env as Record<string, string | undefined>

  function restore() {
    if (originalSources === undefined) delete process.env.TENDER_SOURCES
    else process.env.TENDER_SOURCES = originalSources

    if (originalNodeEnv === undefined) delete mutableEnv.NODE_ENV
    else mutableEnv.NODE_ENV = originalNodeEnv
  }

  it('reads a comma separated list, trimming blanks', () => {
    process.env.TENDER_SOURCES = ' ppip , mock ,, '
    try {
      assert.deepEqual(enabledSourceIds(), ['ppip', 'mock'])
    } finally {
      restore()
    }
  })

  it('includes mock outside production but never inside it', () => {
    delete process.env.TENDER_SOURCES

    try {
      mutableEnv.NODE_ENV = 'development'
      assert.ok(enabledSourceIds().includes('mock'))

      mutableEnv.NODE_ENV = 'production'
      assert.ok(!enabledSourceIds().includes('mock'))

      // Every real source still runs in production.
      assert.ok(enabledSourceIds().includes('ppip'))
    } finally {
      restore()
    }
  })
})

describe('fetchAllTenders', () => {
  it('merges results from every selected source', async () => {
    const { tenders, sources } = await fetchAllTenders(
      [source('a', [row('https://x.test/1')]), source('b', [row('https://x.test/2')])],
      ['a', 'b'],
    )

    assert.equal(tenders.length, 2)
    assert.deepEqual(
      sources.map((s) => s.status),
      ['fetched', 'fetched'],
    )
  })

  it('does not let one failing source fail the run', async () => {
    const failing = source('bad', [], {
      async fetchTenders(): Promise<RawTender[]> {
        throw new Error('portal timed out')
      },
    })

    const { tenders, sources } = await fetchAllTenders(
      [failing, source('good', [row('https://x.test/1')])],
      ['bad', 'good'],
    )

    assert.equal(tenders.length, 1)

    const bad = sources.find((s) => s.sourceId === 'bad')
    assert.equal(bad?.status, 'error')
    assert.equal(bad?.detail, 'portal timed out')
  })

  it('reports a skipped, blocked or unconfigured source rather than a silent zero', async () => {
    const { sources } = await fetchAllTenders(
      [
        source('skipped', [row('https://x.test/1')]),
        source('blocked', [], { blockedReason: 'crawl not permitted' }),
        source('unconfigured', [], {
          isConfigured: () => false,
          configHint: 'set THING_URL',
        }),
      ],
      ['blocked', 'unconfigured'],
    )

    const byId = new Map(sources.map((s) => [s.sourceId, s]))

    assert.equal(byId.get('skipped')?.status, 'skipped')
    assert.equal(byId.get('blocked')?.status, 'blocked')
    assert.equal(byId.get('blocked')?.detail, 'crawl not permitted')
    assert.equal(byId.get('unconfigured')?.status, 'skipped')
    assert.equal(byId.get('unconfigured')?.detail, 'set THING_URL')
  })

  it('reports an id in TENDER_SOURCES with no adapter as an error', async () => {
    const { sources } = await fetchAllTenders([source('a', [])], ['a', 'typo'])

    const unknown = sources.find((s) => s.sourceId === 'typo')

    assert.equal(unknown?.status, 'error')
    assert.match(unknown?.detail ?? '', /no adapter with that id/)
  })

  it('collapses a tender listed by two sources, keeping the first', async () => {
    const shared = 'https://x.test/shared'
    const { tenders, sources } = await fetchAllTenders(
      [source('first', [row(shared, 'From first')]), source('second', [row(shared, 'From second')])],
      ['first', 'second'],
    )

    assert.equal(tenders.length, 1)
    assert.equal(tenders[0].title, 'From first')
    assert.match(sources.find((s) => s.sourceId === 'second')?.detail ?? '', /already seen/)
  })

  it('re-normalises what an adapter returned rather than trusting it', async () => {
    // A misbehaving adapter must not be able to push a row with no URL through.
    const sloppy = source('sloppy', [
      { title: 'No url at all' },
      row('https://x.test/ok'),
    ])

    const { tenders, sources } = await fetchAllTenders([sloppy], ['sloppy'])

    assert.equal(tenders.length, 1)
    assert.equal(sources[0].discarded, 1)
  })
})

describe('the source registry', () => {
  it('has unique ids, since TENDER_SOURCES selects on them', () => {
    const ids = ALL_SOURCES.map((s) => s.id)

    assert.equal(new Set(ids).size, ids.length)
  })
})

describe('mockSource', () => {
  it('returns fixtures with deadlines relative to now, so they never go stale', async () => {
    const tenders = await mockSource.fetchTenders()

    assert.ok(tenders.length > 5)

    const today = new Date().toISOString().slice(0, 10)

    assert.ok(
      tenders.some((t) => t.deadline !== null && t.deadline > today),
      'no fixture is still open',
    )
    assert.ok(
      tenders.some((t) => t.deadline !== null && t.deadline < today),
      'no expired fixture, so expiry filtering is never exercised',
    )
  })

  it('spreads across sectors so scoring can be seen to discriminate', async () => {
    const titles = (await mockSource.fetchTenders()).map((t) => t.title.toLowerCase())

    for (const word of ['cloud', 'water', 'road', 'pharmaceutical', 'cleaning']) {
      assert.ok(titles.some((t) => t.includes(word)), `no fixture mentions ${word}`)
    }
  })
})
