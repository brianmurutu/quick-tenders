import { NextResponse, type NextRequest } from 'next/server'

import { isCronAuthorised } from '@/lib/cron-auth'
import { formatDraftingSummary, runDrafting } from '@/lib/tender-documents'

/**
 * Scheduled bid document drafting.
 *
 * Its own schedule rather than being chained onto the matching insert. The
 * reasoning is written out at the top of lib/tender-documents.ts.
 *
 * Triggering is the same as the discovery job: Vercel Cron (see vercel.json),
 * Supabase pg_cron with pg_net, or any scheduler that can send a bearer token.
 */

export const dynamic = 'force-dynamic'

/**
 * Two model calls, two uploads and an email per tender, run sequentially, so the
 * ceiling is roughly a dozen tenders per invocation. `limit` defaults to 25 and
 * the queue is self healing, so anything not reached this tick is picked up on
 * the next one.
 */
export const maxDuration = 300

async function handle(request: NextRequest): Promise<NextResponse> {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dry_run') === 'true'
  const limitParam = Number(url.searchParams.get('limit'))
  const limit =
    Number.isInteger(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : undefined

  try {
    const summary = await runDrafting({ dryRun, limit })

    console.log(formatDraftingSummary(summary))

    const failed =
      summary.errors.length > 0 ||
      summary.tenders.some((tender) => tender.errors.length > 0)

    // 207 means the run happened but something inside it failed, so a scheduler
    // can react without treating partial success as total failure.
    return NextResponse.json(summary, { status: failed ? 207 : 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    console.error(`[draft-documents] run failed: ${message}`)

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return await handle(request)
}

export async function POST(request: NextRequest) {
  return await handle(request)
}
