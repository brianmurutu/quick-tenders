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
      title: 'Supply, Installation and Configuration of Enterprise Cloud Infrastructure and Network Security Solutions',
      source_url: 'https://example.test/tenders/mock-nairobi-cloud-infrastructure',
      deadline: daysFromNow(14),
      description:
        'Supply, installation, configuration and commissioning of enterprise-grade cloud computing infrastructure, managed firewall switches, structured network cabling, and cyber security endpoint protection across county headquarters. Contractor must demonstrate relevant ICT certifications, past public sector projects, and valid tax compliance.',
      procuring_entity: 'Nairobi City County Government',
    },
    {
      title: 'Design, Development, Implementation and Commissioning of Unified Digital Revenue Collection and ERP System',
      source_url: 'https://example.test/tenders/mock-revenue-erp-system',
      deadline: daysFromNow(24),
      description:
        'Design, custom software development, cloud deployment and 3-year SLA support for an integrated revenue collection, licensing and ERP platform. Features real-time M-Pesa STK push reconciliation, automated invoicing, analytics dashboards, and role-based access control. Prior public sector software implementation required.',
      procuring_entity: 'Mombasa County Treasury & Revenue Board',
    },
    {
      title: 'Supply and Delivery of ICT Equipment, High-Performance Servers and Networking Infrastructure',
      source_url: 'https://example.test/tenders/mock-ict-hardware-servers',
      deadline: daysFromNow(18),
      description:
        'Supply, delivery and setup of rack-mounted servers, unmanaged/managed gigabit switches, Cat6A structured cabling, enterprise uninterruptible power supplies (UPS), and licensed productivity software. Manufacturer authorization letters and 3-year warranty required.',
      procuring_entity: 'Ministry of Information, Communications and The Digital Economy',
    },
    {
      title: 'Provision of Software Maintenance, System Integration and API Gateway Modernization Services',
      source_url: 'https://example.test/tenders/mock-software-maintenance-api',
      deadline: daysFromNow(10),
      description:
        'Provision of specialized software engineering, API integration, database performance tuning, and technical support services for citizen-facing digital services. Requires proven expertise in TypeScript, Python, PostgreSQL, and microservices architecture.',
      procuring_entity: 'Judiciary of Kenya - ICT Directorate',
    },
    {
      title: 'Supply, Installation and Commissioning of Countywide CCTV Surveillance and Access Control System',
      source_url: 'https://example.test/tenders/mock-cctv-surveillance-system',
      deadline: daysFromNow(20),
      description:
        'Turnkey supply, cabling, installation, and monitoring setup for IP CCTV cameras, Network Video Recorders (NVR), biometric access control units, and central control room monitoring screens.',
      procuring_entity: 'Kiambu County Administration',
    },
    {
      title: 'Municipal water infrastructure upgrade',
      source_url: 'https://example.test/tenders/mock-water-infrastructure-upgrade',
      deadline: daysFromNow(12),
      description:
        'Supply, installation and commissioning of water distribution pipework, booster pumps and metering for a municipal supply zone. Contractor must hold a valid NCA registration and demonstrate three comparable completed works. Bid bond required.',
      procuring_entity: 'Nakuru County Water and Sanitation',
    },
    {
      title: 'Rehabilitation of 14km rural access road',
      source_url: 'https://example.test/tenders/mock-rural-access-road',
      deadline: daysFromNow(21),
      description:
        'Grading, gravelling and drainage works on 14km of rural access road, including three box culverts. Plant and equipment schedule to be submitted with the bid.',
      procuring_entity: 'Nakuru County Roads and Transport',
    },
    {
      title: 'Supply of assorted pharmaceuticals and non-pharmaceuticals',
      source_url: 'https://example.test/tenders/mock-pharmaceutical-supply',
      deadline: daysFromNow(9),
      description:
        'Framework agreement for the supply of essential medicines and medical consumables to county health facilities. Bidders must be licensed by the Pharmacy and Poisons Board.',
      procuring_entity: 'Kiambu County Department of Health',
    },
    {
      title: 'Provision of cleaning and fumigation services',
      source_url: 'https://example.test/tenders/mock-cleaning-services',
      deadline: daysFromNow(6),
      description:
        'Two year contract for cleaning, sanitation and quarterly fumigation across eleven county offices. Staffing schedule and OSHA compliance evidence required.',
      procuring_entity: 'Nairobi City County Public Service Board',
    },
    {
      // Intentionally past its closing date, so filtering can be exercised.
      title: 'Expired notice, supply of office furniture',
      source_url: 'https://example.test/tenders/mock-expired-furniture',
      deadline: daysFromNow(-4),
      description:
        'Supply and delivery of office desks, chairs and filing cabinets. This fixture is deliberately past its deadline.',
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
