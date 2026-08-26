/**
 * Document type constants and the Storage layout.
 *
 * Kept in its own module, free of any SDK import, so the dashboard pages can
 * label a document or build an object path without pulling the Grok client
 * into the page bundle. lib/tender-drafting.ts re-exports these for the jobs.
 */

export type DraftDocumentType = 'cover_letter' | 'technical_proposal'

export const DOCUMENT_TYPES: DraftDocumentType[] = ['cover_letter', 'technical_proposal']

export const DOCUMENT_LABELS: Record<DraftDocumentType, string> = {
  cover_letter: 'Cover letter',
  technical_proposal: 'Technical proposal skeleton',
}

export const STORAGE_BUCKET = 'tender-documents'

/** Signed download links are short lived by design. Each click mints a new one. */
export const DOWNLOAD_URL_TTL_SECONDS = 60

export function isDraftDocumentType(value: unknown): value is DraftDocumentType {
  return typeof value === 'string' && (DOCUMENT_TYPES as string[]).includes(value)
}

/**
 * Label for a doc_type as stored. The column is free text, so a row written by
 * something other than the drafting job still gets a readable name.
 */
export function documentLabel(docType: string | null): string {
  if (!docType) return 'Document'

  if (isDraftDocumentType(docType)) return DOCUMENT_LABELS[docType]

  return docType
    .replace(/[_-]+/g, ' ')
    .replace(/^\s*(\w)/, (_, first: string) => first.toUpperCase())
    .trim()
}

/** Object key. The first segment is the tenancy key the storage policy checks. */
export function storagePath(
  companyId: string,
  tenderId: string,
  docType: DraftDocumentType,
): string {
  return `${companyId}/${tenderId}/${docType}.docx`
}

/** Filename offered to the browser. Keeps the tender identifiable on disk. */
export function downloadFileName(tenderTitle: string | null, docType: string | null): string {
  const slug = (tenderTitle ?? 'tender')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

  const type = (docType ?? 'document').replace(/[^a-z0-9_-]+/gi, '')

  return `${slug || 'tender'}-${type}.docx`
}
