/**
 * Minimal DOCX writer.
 *
 * DOCX is chosen over PDF because these are drafts a representative has to edit
 * before submitting: a proposal skeleton full of placeholders is useless if it
 * cannot be typed into. A PDF would look more finished and be less usable.
 *
 * Written out rather than pulled from a dependency because a .docx is a ZIP of
 * three small XML files, and Node has everything needed: zlib.deflateRawSync for
 * the entries and zlib.crc32 for the checksums. No new package, which also keeps
 * the deployment footprint down.
 *
 * Deliberately narrow: headings, paragraphs, bold or italic runs, and simple
 * bullets, using direct run formatting. No styles.xml and no numbering.xml,
 * because neither is needed for that and both are a lot of surface to get wrong.
 */

import { crc32, deflateRawSync } from 'node:zlib'

export type DocxBlock =
  | { type: 'heading'; text: string; level?: 1 | 2 }
  | { type: 'paragraph'; text: string; bold?: boolean; italic?: boolean }
  | { type: 'bullet'; text: string }
  | { type: 'spacer' }

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

export const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/**
 * Characters illegal in XML 1.0 text: the C0 control range, except tab (0009),
 * line feed (000A) and carriage return (000D), which are legal and are kept.
 *
 * Done by code point rather than a regex so the source carries no literal
 * control bytes of its own.
 */
function stripIllegalXmlChars(value: string): string {
  let out = ''

  for (const char of value) {
    const code = char.codePointAt(0) ?? 0

    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) continue

    out += char
  }

  return out
}

/** XML text escaping. Model output reaches this, so it is not optional. */
export function escapeXml(value: string): string {
  return stripIllegalXmlChars(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function run(text: string, options: { bold?: boolean; italic?: boolean; size?: number } = {}) {
  const properties = [
    options.bold ? '<w:b/>' : '',
    options.italic ? '<w:i/>' : '',
    // w:sz is in half points, so 24 is 12pt.
    options.size ? `<w:sz w:val="${options.size}"/><w:szCs w:val="${options.size}"/>` : '',
  ].join('')

  const runProperties = properties ? `<w:rPr>${properties}</w:rPr>` : ''

  // xml:space="preserve" stops Word trimming meaningful leading spaces.
  return `<w:r>${runProperties}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`
}

function paragraph(inner: string, spacingAfter = 120, indentLeft = 0): string {
  const indent = indentLeft ? `<w:ind w:left="${indentLeft}"/>` : ''

  return `<w:p><w:pPr><w:spacing w:after="${spacingAfter}"/>${indent}</w:pPr>${inner}</w:p>`
}

function blockToXml(block: DocxBlock): string {
  switch (block.type) {
    case 'heading':
      return paragraph(
        run(block.text, { bold: true, size: block.level === 2 ? 26 : 32 }),
        block.level === 2 ? 120 : 200,
      )

    case 'paragraph':
      return paragraph(run(block.text, { bold: block.bold, italic: block.italic }))

    case 'bullet':
      // A literal dash rather than a numbering definition: valid, portable, and
      // the reader can retype it as a real list if they want one.
      return paragraph(run(`- ${block.text}`), 60, 360)

    case 'spacer':
      return paragraph('', 200)
  }
}

function documentXml(blocks: DocxBlock[]): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${blocks
    .map(blockToXml)
    .join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`
}

type ZipEntry = { name: string; data: Buffer }

// Fixed DOS timestamp (1 January 2026, 00:00) so the same content always
// produces the same bytes. Makes the output testable and diffable.
const DOS_TIME = 0
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1

function zip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8')
    const compressed = deflateRawSync(entry.data)
    const checksum = crc32(entry.data)

    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4) // version needed
    localHeader.writeUInt16LE(0, 6) // flags
    localHeader.writeUInt16LE(8, 8) // method: deflate
    localHeader.writeUInt16LE(DOS_TIME, 10)
    localHeader.writeUInt16LE(DOS_DATE, 12)
    localHeader.writeUInt32LE(checksum, 14)
    localHeader.writeUInt32LE(compressed.length, 18)
    localHeader.writeUInt32LE(entry.data.length, 22)
    localHeader.writeUInt16LE(name.length, 26)
    localHeader.writeUInt16LE(0, 28) // extra length

    locals.push(localHeader, name, compressed)

    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt16LE(20, 4) // version made by
    centralHeader.writeUInt16LE(20, 6) // version needed
    centralHeader.writeUInt16LE(0, 8) // flags
    centralHeader.writeUInt16LE(8, 10) // method
    centralHeader.writeUInt16LE(DOS_TIME, 12)
    centralHeader.writeUInt16LE(DOS_DATE, 14)
    centralHeader.writeUInt32LE(checksum, 16)
    centralHeader.writeUInt32LE(compressed.length, 20)
    centralHeader.writeUInt32LE(entry.data.length, 24)
    centralHeader.writeUInt16LE(name.length, 28)
    centralHeader.writeUInt16LE(0, 30) // extra
    centralHeader.writeUInt16LE(0, 32) // comment
    centralHeader.writeUInt16LE(0, 34) // disk start
    centralHeader.writeUInt16LE(0, 36) // internal attrs
    centralHeader.writeUInt32LE(0, 38) // external attrs
    centralHeader.writeUInt32LE(offset, 42) // local header offset

    centrals.push(centralHeader, name)

    offset += localHeader.length + name.length + compressed.length
  }

  const centralDirectory = Buffer.concat(centrals)

  const endRecord = Buffer.alloc(22)
  endRecord.writeUInt32LE(0x06054b50, 0)
  endRecord.writeUInt16LE(0, 4) // this disk
  endRecord.writeUInt16LE(0, 6) // disk with central directory
  endRecord.writeUInt16LE(entries.length, 8)
  endRecord.writeUInt16LE(entries.length, 10)
  endRecord.writeUInt32LE(centralDirectory.length, 12)
  endRecord.writeUInt32LE(offset, 16)
  endRecord.writeUInt16LE(0, 20) // comment length

  return Buffer.concat([...locals, centralDirectory, endRecord])
}

/** Builds a .docx package. The order of the parts follows the OOXML convention. */
export function buildDocx(blocks: DocxBlock[]): Buffer {
  return zip([
    { name: '[Content_Types].xml', data: Buffer.from(CONTENT_TYPES, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(ROOT_RELS, 'utf8') },
    { name: 'word/document.xml', data: Buffer.from(documentXml(blocks), 'utf8') },
  ])
}
