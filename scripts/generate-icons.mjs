/**
 * Generates the Quick Tenders raster icons from the same geometry the on-page
 * mark uses (components/logo.tsx, app/icon.svg).
 *
 * Run with: npm run icons
 *
 * Why hand-rolled instead of ImageMagick/sharp: the mark is two analytic
 * shapes (a ring and a capsule) clipped to a badge, so exact per-pixel coverage
 * is cheaper to compute than to install. That keeps icon generation reproducible
 * on a clean checkout with no native deps and no binary in PATH. It also means
 * the 16px favicon is rasterised directly at 16px rather than downsampled from
 * a large bitmap, which is what keeps it crisp.
 *
 * Outputs (see ICONS below):
 *   app/favicon.ico      16 + 32 + 48, rounded badge
 *   app/apple-icon.png   180, full-bleed (iOS applies its own mask)
 *   public/icon-192.png  full-bleed, safe for Android maskable masks
 *   public/icon-512.png  same at 512
 */

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// -- Brand ------------------------------------------------------------------

/** Tailwind blue-700, the primary already used across the site. */
const BLUE = [0x1d, 0x4e, 0xd8]
const WHITE = [0xff, 0xff, 0xff]

/**
 * Mark geometry in a normalised 0..1 box. Kept in sync with the `viewBox
 * 0 0 100 100` numbers in components/logo.tsx — divide those by 100.
 */
const BADGE_RADIUS = 0.22
const RING = { cx: 0.48, cy: 0.45, r: 0.22 }
const TAIL = { x1: 0.64, y1: 0.61, x2: 0.78, y2: 0.75 }
/** Half the stroke weight, shared by the ring and the tail. */
const STROKE = 0.07

/**
 * `scale` shrinks the glyph about the centre so it survives a platform mask.
 * The tail's far cap is the outermost point, at radius 0.445 from centre.
 * Android's maskable spec only guarantees a centred circle of 80% diameter
 * (radius 0.4), so anything above ~0.89 scale risks clipping there; iOS masks
 * with a squircle and tolerates more.
 */
const ICONS = [
  { file: 'app/apple-icon.png', size: 180, rounded: false, scale: 0.86 },
  { file: 'public/icon-192.png', size: 192, rounded: false, scale: 0.82 },
  { file: 'public/icon-512.png', size: 512, rounded: false, scale: 0.82 },
]

const ICO_SIZES = [16, 32, 48]

// -- Geometry ---------------------------------------------------------------

/** Containment test for the full 0..1 box with rounded corners. */
function insideBadge(x, y, radius) {
  if (x < 0 || x > 1 || y < 0 || y > 1) return false
  if (radius <= 0) return true

  const dx = Math.min(x, 1 - x)
  const dy = Math.min(y, 1 - y)
  if (dx >= radius || dy >= radius) return true

  // Inside a corner quadrant: measure against that corner's arc centre.
  const ox = radius - dx
  const oy = radius - dy
  return ox * ox + oy * oy <= radius * radius
}

function distanceToSegment(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSq = dx * dx + dy * dy
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSq))
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
}

/** True where the white "Q" glyph covers the point. */
function insideGlyph(x, y, scale) {
  // Undo the scale so the glyph is tested at its authored size.
  const gx = 0.5 + (x - 0.5) / scale
  const gy = 0.5 + (y - 0.5) / scale

  const ring = Math.abs(Math.hypot(gx - RING.cx, gy - RING.cy) - RING.r) <= STROKE
  if (ring) return true

  return distanceToSegment(gx, gy, TAIL.x1, TAIL.y1, TAIL.x2, TAIL.y2) <= STROKE
}

/**
 * Renders straight (non-premultiplied) RGBA. 8x8 supersampling gives 64 alpha
 * levels per edge pixel, which is what the 16px favicon needs to not look
 * jagged.
 */
export function render(size, { rounded, scale }) {
  const SAMPLES = 8
  const total = SAMPLES * SAMPLES
  const radius = rounded ? BADGE_RADIUS : 0
  const rgba = Buffer.alloc(size * size * 4)

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let covered = 0
      let r = 0
      let g = 0
      let b = 0

      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = (px + (sx + 0.5) / SAMPLES) / size
          const y = (py + (sy + 0.5) / SAMPLES) / size
          if (!insideBadge(x, y, radius)) continue

          const colour = insideGlyph(x, y, scale) ? WHITE : BLUE
          r += colour[0]
          g += colour[1]
          b += colour[2]
          covered++
        }
      }

      const offset = (py * size + px) * 4
      if (covered === 0) continue

      rgba[offset] = Math.round(r / covered)
      rgba[offset + 1] = Math.round(g / covered)
      rgba[offset + 2] = Math.round(b / covered)
      rgba[offset + 3] = Math.round((covered / total) * 255)
    }
  }

  return rgba
}

// -- PNG --------------------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)

  const typed = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typed))

  return Buffer.concat([length, typed, crc])
}

export function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  ihdr[10] = 0 // deflate
  ihdr[11] = 0 // adaptive filtering
  ihdr[12] = 0 // no interlace

  // Each scanline is prefixed with its filter byte (0 = None).
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// -- ICO --------------------------------------------------------------------

/**
 * Packs PNGs into an .ico. PNG-compressed entries are the Vista+ form and are
 * what every current browser reads; the legacy BMP form would only matter for
 * XP-era clients.
 */
function encodeIco(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(entries.length, 4)

  const directory = Buffer.alloc(entries.length * 16)
  let offset = header.length + directory.length

  entries.forEach(({ size, png }, index) => {
    const at = index * 16
    directory[at] = size === 256 ? 0 : size
    directory[at + 1] = size === 256 ? 0 : size
    directory[at + 2] = 0 // palette count
    directory[at + 3] = 0 // reserved
    directory.writeUInt16LE(1, at + 4) // colour planes
    directory.writeUInt16LE(32, at + 6) // bits per pixel
    directory.writeUInt32LE(png.length, at + 8)
    directory.writeUInt32LE(offset, at + 12)
    offset += png.length
  })

  return Buffer.concat([header, directory, ...entries.map((entry) => entry.png)])
}

// -- Run --------------------------------------------------------------------

function write(relativePath, data) {
  const target = join(root, relativePath)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, data)
  console.log(`  ${relativePath.padEnd(22)} ${(data.length / 1024).toFixed(1)} KB`)
}

console.log('Generating Quick Tenders icons')

write(
  'app/favicon.ico',
  encodeIco(
    ICO_SIZES.map((size) => ({
      size,
      png: encodePng(size, render(size, { rounded: true, scale: 1 })),
    })),
  ),
)

for (const { file, size, rounded, scale } of ICONS) {
  write(file, encodePng(size, render(size, { rounded, scale })))
}

console.log('Done.')
