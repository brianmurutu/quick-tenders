/**
 * Guards against turning our own redirect parameters into an open redirector.
 *
 * Only same-origin relative paths are allowed through. Anything else, including
 * protocol-relative URLs (//evil.example) and absolute URLs, falls back to the
 * given default.
 */
export function safeRelativePath(raw: string | null | undefined, fallback = '/'): string {
  if (!raw) return fallback

  // Protocol-relative and scheme-qualified URLs both leave our origin.
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback

  // Backslashes are normalised to forward slashes by some clients, so \\host
  // would escape the origin too.
  if (raw.startsWith('/\\')) return fallback

  return raw
}
