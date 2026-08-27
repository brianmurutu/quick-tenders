import { timingSafeEqual } from 'node:crypto'

import type { NextRequest } from 'next/server'

/**
 * Shared authorisation for the scheduled endpoints.
 *
 * Extracted so the discovery and drafting routes cannot drift apart: a fix to one
 * would otherwise silently leave the other weaker.
 */

/** Constant time compare, so the endpoint does not leak the secret by timing. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)

  // timingSafeEqual throws on a length mismatch, which would itself be a signal.
  if (a.length !== b.length) return false

  return timingSafeEqual(a, b)
}

/**
 * True only when the caller presents CRON_SECRET.
 *
 * Fails closed: an unset CRON_SECRET shuts the endpoint rather than opening it.
 * Accepts a bearer token (what Vercel Cron sends) or X-Cron-Secret (for
 * schedulers that cannot set an Authorization header).
 */
export function isCronAuthorised(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET?.trim()

  if (!expected) return false

  const header = request.headers.get('authorization') ?? ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : ''

  if (bearer && secretMatches(bearer, expected)) return true

  const alternative = request.headers.get('x-cron-secret') ?? ''

  return Boolean(alternative) && secretMatches(alternative, expected)
}
