/**
 * Drafts the two bid documents for one match, via the xAI Grok API.
 *
 * The output is explicitly a STARTING POINT, not a submission. The prompt forbids
 * inventing anything factual: no certifications, no past contracts, no staff
 * numbers, no prices. Anything the company alone can supply comes back as a
 * bracketed placeholder for a person to fill in. A drafted bid that quietly
 * invented an NCA registration would be worse than no draft at all, because
 * somebody might submit it.
 */

import { buildDocx, type DocxBlock } from '@/lib/docx'
import type { GrokClient } from '@/lib/grok'
import {
  DOCUMENT_LABELS,
  DOCUMENT_TYPES,
  type DraftDocumentType,
} from '@/lib/document-types'

// Re-exported so the jobs can keep importing these from here.
export { DOCUMENT_LABELS, DOCUMENT_TYPES }
export type { DraftDocumentType }

export type DraftContext = {
  tenderTitle: string
  tenderSummary: string | null
  procuringEntity: string | null
  deadline: string | null
  sourceUrl: string | null
  companyName: string | null
  industry: string | null
  sectorsOfInterest: string[] | null
  region: string | null
  companySize: string | null
}

export type DraftSection = {
  heading: string
  paragraphs: string[]
  bullets: string[]
}

export type DraftDocument = {
  docType: DraftDocumentType
  title: string
  sections: DraftSection[]
}

const MAX_SECTIONS = 12
const MAX_ITEMS_PER_SECTION = 20
const MAX_TEXT_LENGTH = 2000

const SHARED_RULES = [
  'Hard rules, which matter more than sounding polished:',
  '  - Never state a fact about the company that you were not given. No',
  '    certifications, registrations, licences, past contracts, referees,',
  '    turnover, equipment, staff numbers, prices or dates.',
  '  - Where such a fact is needed, write a placeholder in square brackets that',
  '    says exactly what to supply, for example',
  '    [INSERT: NCA registration number and category] or',
  '    [INSERT: two comparable completed works, with client and value].',
  '  - Do not claim the company meets a requirement. Write the requirement and a',
  '    placeholder for the evidence.',
  '  - Do not invent details of the tender that were not in the summary given.',
  '  - Plain professional English. No filler, no marketing adjectives.',
].join('\n')

const PROMPTS: Record<DraftDocumentType, string> = {
  cover_letter: [
    'Draft a cover letter for this company to submit with a bid.',
    '',
    'Shape: addressee block placeholder, a subject line naming the tender, three',
    'to five short paragraphs, and a signature block placeholder. Say what the',
    'company does, connect it to the scope of this tender, and state that the',
    'required documents are enclosed. One page.',
    '',
    SHARED_RULES,
  ].join('\n'),

  technical_proposal: [
    'Draft a technical proposal SKELETON for this company to complete.',
    '',
    'This is scaffolding, not a finished proposal. Give the section structure a',
    'response of this kind needs, and under each heading give either short',
    'guidance on what belongs there or bullet placeholders to fill in. Cover at',
    'least: understanding of the requirement, proposed approach and methodology,',
    'work programme, team and roles, plant and equipment, quality and safety,',
    'relevant experience, and compliance with the stated eligibility criteria.',
    '',
    'Prefer placeholders over prose. The person completing this should be able to',
    'see at a glance what they still have to supply.',
    '',
    SHARED_RULES,
  ].join('\n'),
}

function describeContext(context: DraftContext): string {
  const sectors = context.sectorsOfInterest?.length
    ? context.sectorsOfInterest.join(', ')
    : 'not stated'

  return [
    '<company>',
    `Name: ${context.companyName ?? 'not stated'}`,
    `Industry: ${context.industry ?? 'not stated'}`,
    `Sectors of interest: ${sectors}`,
    `Based in: ${context.region ?? 'not stated'} county`,
    `Headcount band: ${context.companySize ?? 'not stated'}`,
    '</company>',
    '',
    '<tender>',
    `Title: ${context.tenderTitle}`,
    `Procuring entity: ${context.procuringEntity ?? 'not stated'}`,
    `Closing date: ${context.deadline ?? 'not stated'}`,
    `Summary: ${context.tenderSummary ?? 'not provided'}`,
    '</tender>',
  ].join('\n')
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const trimmed = value.replace(/\s+/g, ' ').trim()

  return trimmed ? trimmed.slice(0, MAX_TEXT_LENGTH) : null
}

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return value
    .map(cleanText)
    .filter((item): item is string => item !== null)
    .slice(0, MAX_ITEMS_PER_SECTION)
}

/**
 * Validates the tool result. Model output is input: a section with no heading and
 * no content is dropped, and a document with no usable section at all fails so
 * the caller can retry rather than storing an empty file.
 */
export function parseDraft(
  input: unknown,
  docType: DraftDocumentType,
): DraftDocument | null {
  if (!input || typeof input !== 'object') return null

  const raw = input as { title?: unknown; sections?: unknown }
  const title = cleanText(raw.title) ?? DOCUMENT_LABELS[docType]

  if (!Array.isArray(raw.sections)) return null

  const sections: DraftSection[] = []

  for (const entry of raw.sections.slice(0, MAX_SECTIONS)) {
    if (!entry || typeof entry !== 'object') continue

    const candidate = entry as { heading?: unknown; paragraphs?: unknown; bullets?: unknown }
    const heading = cleanText(candidate.heading)
    const paragraphs = cleanList(candidate.paragraphs)
    const bullets = cleanList(candidate.bullets)

    if (!heading && paragraphs.length === 0 && bullets.length === 0) continue

    sections.push({ heading: heading ?? '', paragraphs, bullets })
  }

  if (sections.length === 0) return null

  return { docType, title, sections }
}

/**
 * The banner every generated document opens with.
 *
 * It is not decoration. Somebody will eventually forward one of these straight
 * to a procuring entity, and it should be obvious on the first line that it is
 * unfinished.
 */
export function draftToBlocks(
  document: DraftDocument,
  context: DraftContext,
): DocxBlock[] {
  const blocks: DocxBlock[] = [
    { type: 'heading', text: document.title, level: 1 },
    {
      type: 'paragraph',
      text:
        'DRAFT, generated automatically by Quick Tenders. Every bracketed ' +
        'placeholder must be completed and every statement checked before this ' +
        'is submitted. Nothing here has been verified against your records.',
      italic: true,
    },
    { type: 'spacer' },
    { type: 'paragraph', text: `Tender: ${context.tenderTitle}`, bold: true },
  ]

  if (context.procuringEntity) {
    blocks.push({ type: 'paragraph', text: `Procuring entity: ${context.procuringEntity}` })
  }

  if (context.deadline) {
    blocks.push({ type: 'paragraph', text: `Closing date: ${context.deadline}` })
  }

  if (context.sourceUrl) {
    blocks.push({ type: 'paragraph', text: `Source: ${context.sourceUrl}` })
  }

  blocks.push({ type: 'spacer' })

  for (const section of document.sections) {
    if (section.heading) {
      blocks.push({ type: 'heading', text: section.heading, level: 2 })
    }

    for (const paragraph of section.paragraphs) {
      blocks.push({ type: 'paragraph', text: paragraph })
    }

    for (const bullet of section.bullets) {
      blocks.push({ type: 'bullet', text: bullet })
    }

    blocks.push({ type: 'spacer' })
  }

  return blocks
}

/** Drafts one document. Throws on API failure so the caller can decide. */
export async function draftDocument(
  client: GrokClient,
  docType: DraftDocumentType,
  context: DraftContext,
): Promise<DraftDocument | null> {
  const response = await client.completeJson(
    PROMPTS[docType],
    [
      describeContext(context),
      '',
      'Return only JSON in this form: {"title":"...","sections":[{"heading":"...","paragraphs":["..."],"bullets":["..."]}]}.',
    ].join('\n'),
  )
  return parseDraft(response, docType)
}

export type RenderedDocument = {
  docType: DraftDocumentType
  fileName: string
  bytes: Buffer
}

export function renderDocument(
  document: DraftDocument,
  context: DraftContext,
): RenderedDocument {
  return {
    docType: document.docType,
    fileName: `${document.docType}.docx`,
    bytes: buildDocx(draftToBlocks(document, context)),
  }
}
