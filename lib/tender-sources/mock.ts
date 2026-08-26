/**
 * Fixed sample tenders, for testing the runner without touching a live source.
 *
 * The first entry is the one shown on the marketing page, so the demo and the
 * pipeline agree. Deliberately spread across sectors and counties so scoring can
 * be seen to discriminate: a Nakuru water contractor should score high on the
 * first and low on the pharmaceutical and ICT ones.
 *
 * Never enabled by default in production. See TENDER_SOURCES in
 * lib/tender-sources/index.ts.
 */

import { normaliseTenders, type RawTender, type TenderSource } from './types'

const ENTITY = 'Mock procuring entity'

/** Kept relative to run time so the fixtures never go stale. */
function daysFromNow(days: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)

  return date.toISOString().slice(0, 10)
}

function rows(): Partial<RawTender>[] {
  return [
    {
      title: 'Municipal water infrastructure upgrade',
      source_url: 'https://example.test/tenders/mock-water-infrastructure-upgrade',
      deadline: daysFromNow(12),
      description:
        'Supply, installation and commissioning of water distribution pipework, ' +
        'booster pumps and metering for a municipal supply zone. Contractor must ' +
        'hold a valid NCA registration and demonstrate three comparable ' +
        'completed works. Bid bond required.',
      procuring_entity: 'Nakuru County Water and Sanitation',
    },
    {
      title: 'Rehabilitation of 14km rural access road',
      source_url: 'https://example.test/tenders/mock-rural-access-road',
      deadline: daysFromNow(21),
      description:
        'Grading, gravelling and drainage works on 14km of rural access road, ' +
        'including three box culverts. Plant and equipment schedule to be ' +
        'submitted with the bid.',
      procuring_entity: 'Nakuru County Roads and Transport',
    },
    {
      title: 'Supply of assorted pharmaceuticals and non-pharmaceuticals',
      source_url: 'https://example.test/tenders/mock-pharmaceutical-supply',
      deadline: daysFromNow(9),
      description:
        'Framework agreement for the supply of essential medicines and medical ' +
        'consumables to county health facilities. Bidders must be licensed by the ' +
        'Pharmacy and Poisons Board.',
      procuring_entity: 'Kiambu County Department of Health',
    },
    {
      title: 'Design and implementation of a revenue collection system',
      source_url: 'https://example.test/tenders/mock-revenue-system',
      deadline: daysFromNow(30),
      description:
        'Design, development, deployment and one year support of an integrated ' +
        'revenue management platform with mobile money reconciliation and ' +
        'reporting. Prior public sector implementations required.',
      procuring_entity: 'Mombasa County Treasury',
    },
    {
      title: 'Provision of cleaning and fumigation services',
      source_url: 'https://example.test/tenders/mock-cleaning-services',
      deadline: daysFromNow(6),
      description:
        'Two year contract for cleaning, sanitation and quarterly fumigation ' +
        'across eleven county offices. Staffing schedule and OSHA compliance ' +
        'evidence required.',
      procuring_entity: 'Nairobi City County Public Service Board',
    },
    {
      // Intentionally past its closing date, so filtering can be exercised.
      title: 'Expired notice, supply of office furniture',
      source_url: 'https://example.test/tenders/mock-expired-furniture',
      deadline: daysFromNow(-4),
      description:
        'Supply and delivery of office desks, chairs and filing cabinets. This ' +
        'fixture is deliberately past its deadline.',
      procuring_entity: 'Machakos County Administration',
    },
  ]
}

export const mockSource: TenderSource = {
  id: 'mock',
  label: 'Mock tenders (testing)',

  isConfigured() {
    return true
  },

  async fetchTenders(): Promise<RawTender[]> {
    const { tenders } = normaliseTenders(rows(), ENTITY)

    return tenders
  },
}
