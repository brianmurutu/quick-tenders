import { ImageResponse } from 'next/og'

export const alt = 'Quick Tenders — an AI agent that finds your tenders and drafts the bids'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * The edge runtime is required here, not a preference: @vercel/og's Node build
 * resolves its bundled font through `fileURLToPath(import.meta.url)`, which
 * throws `Invalid URL` when the project path contains spaces (as it does under
 * OneDrive on Windows). The edge build has the font inlined and sidesteps it.
 */
export const runtime = 'edge'

/**
 * Social card. The mark is rebuilt from divs rather than reusing <LogoMark />
 * because Satori (what ImageResponse renders with) supports only a subset of
 * SVG; a bordered circle plus a rotated capsule is the same shape in primitives
 * it renders reliably. Numbers are the 0..100 geometry from components/logo.tsx
 * scaled by 0.96 to a 96px badge.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          background: '#0f172a',
          padding: 80,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div
            style={{
              display: 'flex',
              position: 'relative',
              width: 96,
              height: 96,
              borderRadius: 21,
              background: '#1d4ed8',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 18,
                top: 15,
                width: 56,
                height: 56,
                borderRadius: 9999,
                border: '13px solid #ffffff',
                boxSizing: 'border-box',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 52,
                top: 59,
                width: 32,
                height: 13,
                borderRadius: 9999,
                background: '#ffffff',
                transform: 'rotate(45deg)',
              }}
            />
          </div>

          <div style={{ fontSize: 40, fontWeight: 600, color: '#ffffff' }}>
            Quick Tenders
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 74,
              fontWeight: 600,
              color: '#ffffff',
              lineHeight: 1.1,
              letterSpacing: -2,
            }}
          >
            An AI agent that finds your tenders and drafts the bids
          </div>
          <div style={{ marginTop: 28, fontSize: 30, color: '#94a3b8' }}>
            3-day free trial · One account per company
          </div>
        </div>
      </div>
    ),
    size,
  )
}
