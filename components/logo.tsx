/**
 * The Quick Tenders mark: a geometric "Q" in a forest badge, its tail extended
 * into a forward stroke.
 *
 * The geometry is duplicated in app/icon.svg and scripts/generate-icons.mjs
 * (normalised to 0..1 there). If these numbers change, rerun `npm run icons`
 * so the favicons follow.
 *
 * The ring is centred slightly up and left of true centre so the tail's weight
 * does not make the glyph read as bottom-heavy.
 */
export function LogoMark({
  className = 'h-7 w-7',
  variant = 'brand',
}: {
  className?: string
  /** `inverse` swaps badge and glyph for use on a dark background. */
  variant?: 'brand' | 'inverse'
}) {
  const badge = variant === 'inverse' ? '#ffffff' : '#0F3D2E'
  const glyph = variant === 'inverse' ? '#0F3D2E' : '#ffffff'

  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <rect width="100" height="100" rx="22" fill={badge} />
      <circle cx="48" cy="45" r="22" fill="none" stroke={glyph} strokeWidth="14" />
      <path d="M64 61 78 75" stroke={glyph} strokeWidth="14" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Mark plus wordmark. The wordmark is real text rather than outlined paths, so
 * it inherits the site font, stays selectable, and is announced as text instead
 * of needing an alt attribute.
 */
export function Logo({
  className = '',
  variant = 'brand',
}: {
  className?: string
  variant?: 'brand' | 'inverse'
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className="h-7 w-7 shrink-0" variant={variant} />
      <span className="brand-name text-base font-semibold">Quick Tenders</span>
    </span>
  )
}
