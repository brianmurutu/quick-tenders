import { NextResponse, type NextRequest } from 'next/server'

import { isCronAuthorised } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatRunSummary, runDiscovery } from '@/lib/tender-discovery'
import type { ScrapeRunStatus } from '@/types/database'

async function recordSourceHealth(
  sources: Awaited<ReturnType<typeof runDiscovery>>['sources'],
): Promise<void> {
  if (sources.length === 0) return

  const rows = sources.map((source) => {
    const status: ScrapeRunStatus =
      source.status === 'fetched'
        ? source.discarded > 0
          ? 'partial'
          : 'success'
        : source.status === 'error' && source.fetched > 0
          ? 'partial'
          : 'failed'

    return {
      source: source.sourceId,
      tenders_fetched: source.fetched,
      status,
      error_message:
        status === 'success'
          ? null
          : (
              source.detail ??
              (source.discarded > 0
                ? `Runner rejected ${source.discarded} tender record(s)`
                : `Source status: ${source.status}`)
            ).slice(0, 2000),
    }
  })

  const { error } = await createAdminClient().from('scrape_runs').insert(rows)
  if (error) {
    throw new Error(`Could not record source health: ${error.message}`)
  }
}

/**
 * Scheduled tender discovery.
 *
 * A Next.js route handler rather than a Supabase Edge Function, because the
 * source adapters live in lib/ and are shared with the rest of the app. An Edge
 * Function runs on Deno in supabase/functions/ with its own module resolution,
 * so it would need either a duplicate copy of the adapters or a bundling step
 * across two runtimes. One TypeScript project, one set of types, one place to add
 * a source, is worth more here than being inside Supabase.
 *
 * Triggering, any one of:
 *   - Vercel Cron. See vercel.json. Vercel sends the CRON_SECRET as a bearer
 *     token automatically when that variable is set on the project.
 *   - Supabase pg_cron plus pg_net, posting to this URL with the same header.
 *   - GitHub Actions, or any scheduler that can send an HTTP request.
 *
 * GET and POST both work: Vercel Cron issues GET, most other schedulers POST.
 */

export const dynamic = 'force-dynamic'

/**
 * Scoring is sequential per company, so a run grows with companies times
 * tenders. 300s needs a plan that allows it; lower it if yours does not. The run
 * is incremental, so a truncated run makes progress and the next one picks up
 * the rest rather than starting over.
 */
export const maxDuration = 300

async function handle(request: NextRequest): Promise<NextResponse> {
  if (!isCronAuthorised(request)) {
    // No detail about why, and no hint as to whether CRON_SECRET is even set.
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dry_run') === 'true'
  const sourceParam = url.searchParams.get('sources')?.trim()

  try {
    const summary = await runDiscovery({
      dryRun,
      sourceIds: sourceParam
        ? sourceParam.split(',').map((id) => id.trim()).filter(Boolean)
        : undefined,
      maxDurationMs: 180_000,
    })

    // The run log the brief asks for: per source, and per company.
    console.log(formatRunSummary(summary))

    try {
      await recordSourceHealth(summary.sources)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[discover-tenders] ${message}`)
      return NextResponse.json(
        { error: `Discovery ran, but source health could not be recorded: ${message}` },
        { status: 500 },
      )
    }

    const failed =
      summary.errors.length > 0 ||
      summary.companies.some((company) => company.errors.length > 0) ||
      summary.sources.some((source) => source.status === 'error')

    // 207 tells a scheduler the run happened but something inside it failed, so
    // a retry policy can react without treating partial success as total failure.
    return NextResponse.json(summary, { status: failed ? 207 : 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    console.error(`[discover-tenders] run failed: ${message}`)

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return await handle(request)
}

export async function POST(request: NextRequest) {
  return await handle(request)
}
