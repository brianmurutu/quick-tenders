import assert from 'node:assert/strict'
import test, { describe } from 'node:test'

import { parseGaaHtml } from '../lib/tender-sources/gaa'
import { parseTendersKenyaHtml } from '../lib/tender-sources/tenders-kenya'
import { parseTendersOnTimeHtml } from '../lib/tender-sources/tendersontime'
import { ALL_SOURCES } from '../lib/tender-sources'

describe('New Tender Source Adapters', () => {
  test('all sources have unique IDs', () => {
    const ids = ALL_SOURCES.map((s) => s.id)
    const unique = new Set(ids)
    assert.equal(ids.length, unique.size)
  })

  test('tendersoko and kenyatenders declare blockedReason', () => {
    const soko = ALL_SOURCES.find((s) => s.id === 'tendersoko')
    const kt = ALL_SOURCES.find((s) => s.id === 'kenyatenders')
    assert.ok(soko?.blockedReason)
    assert.ok(kt?.blockedReason)
    assert.equal(soko?.isConfigured(), false)
    assert.equal(kt?.isConfigured(), false)
  })

  test('parseTendersKenyaHtml extracts tender cards correctly', () => {
    const mockHtml = `
      <div class="col-md-4 mb-4 tenderbox">
        <div class="card h-100">
          <div class="card-body pb-0">
            <a class="tenderbox_title d-block" href="https://www.tenderskenya.co.ke/tender/sample-tender-123">
              <h5 class="mb-0 mt-0 weight-600">Supply of ICT Equipment</h5>
            </a>
          </div>
          <div class="card-footer tenderbox_footer d-block">
            <span class="typcn typcn-home-outline text-dark"></span>
            <span class="text-orange-1">Ministry of ICT</span>
            Close: <span>Oct 15, 2026</span>
          </div>
        </div>
      </div>
    `
    const parsed = parseTendersKenyaHtml(mockHtml)
    assert.equal(parsed.length, 1)
    assert.equal(parsed[0].title, 'Supply of ICT Equipment')
    assert.equal(parsed[0].source_url, 'https://www.tenderskenya.co.ke/tender/sample-tender-123')
    assert.equal(parsed[0].deadline, '2026-10-15')
    assert.equal(parsed[0].procuring_entity, 'Ministry of ICT')
  })

  test('parseGaaHtml parses table rows and resolves URLs', () => {
    const mockHtml = `
      <table>
        <tr><th>No</th><th>Title</th><th>Entity</th><th>Doc</th><th>Date</th></tr>
        <tr>
          <td class="views-field-counter">1</td>
          <td class="views-field-title">Road Construction Project</td>
          <td class="views-field-field-ten">Kenya National Highways Authority</td>
          <td class="views-field-field-tender-documents"><a href="/files/notice.pdf">Notice.pdf</a></td>
          <td class="views-field-field-tender-closing-date">October 20, 2026</td>
        </tr>
      </table>
    `
    const parsed = parseGaaHtml(mockHtml)
    assert.equal(parsed.length, 1)
    assert.equal(parsed[0].title, 'Road Construction Project')
    assert.equal(parsed[0].source_url, 'https://gaa.go.ke/files/notice.pdf')
    assert.equal(parsed[0].deadline, '2026-10-20')
    assert.equal(parsed[0].procuring_entity, 'Kenya National Highways Authority')
  })

  test('parseTendersOnTimeHtml extracts listing boxes', () => {
    const mockHtml = `
      <div class="listingbox mt10">
        <a href="https://www.tendersontime.com/tenders-details/solar-power-plant-abc/" class="givemeEllipsis2">
          <p class="listing-summary">Installation of Solar Power Plant</p>
        </a>
        <p class="list-data">Deadline: <strong>14 Nov 2026</strong></p>
      </div>
    `
    const parsed = parseTendersOnTimeHtml(mockHtml)
    assert.equal(parsed.length, 1)
    assert.equal(parsed[0].title, 'Installation of Solar Power Plant')
    assert.equal(parsed[0].source_url, 'https://www.tendersontime.com/tenders-details/solar-power-plant-abc/')
    assert.equal(parsed[0].deadline, '2026-11-14')
  })
})
