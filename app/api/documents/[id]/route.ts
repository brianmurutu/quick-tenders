import { NextResponse, type NextRequest } from 'next/server'

import {
  DOWNLOAD_URL_TTL_SECONDS,
  STORAGE_BUCKET,
  downloadFileName,
} from '@/lib/document-types'
import { createClient } from '@/lib/supabase/server'
import { isUuid } from '@/lib/tender-status'
import { trialState } from '@/lib/trial'

/**
 * Download one drafted document.
 *
 * The bucket is private, so this mints a short lived signed URL per click and
 * redirects to it. The alternative, embedding signed URLs in the detail page,
 * would put a working credential into HTML that outlives the page view and can be
 * forwarded to anyone.
 *
 * Authorisation is layered, and the first two layers are the ones that matter:
 *
 *   1. RLS on tender_documents. The select below only returns a row whose parent
 *      tender belongs to the caller company, so another company document id is
 *      indistinguishable from one that does not exist.
 *   2. The storage read policy from 0006. createSignedUrl only succeeds for an
 *      object whose first path segment is the caller company, so even a bug here
 *      cannot sign somebody else file.
 *   3. The trial gate, repeated from the dashboard layout because a route handler
 *      is not inside it. Consistent with what /upgrade promises: access pauses,
 *      the data stays.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isUuid(params.id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const { data: company } = await supabase
    .from('companies')
    .select('plan, trial_ends_at')
    .limit(1)
    .maybeSingle()

  // Fail closed, the same way the dashboard layout does.
  if (!company || trialState(company).expired) {
    return NextResponse.json(
      { error: 'Your trial has ended. Upgrade to download documents.' },
      { status: 403 },
    )
  }

  const { data: document } = await supabase
    .from('tender_documents')
    .select('id, doc_type, storage_path, tender_id')
    .eq('id', params.id)
    .maybeSingle()

  if (!document?.storage_path) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Only for the filename offered to the browser. Access was already settled.
  const { data: tender } = await supabase
    .from('tenders_matched')
    .select('title')
    .eq('id', document.tender_id ?? '')
    .maybeSingle()

  const { data: signed, error: signError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(document.storage_path, DOWNLOAD_URL_TTL_SECONDS, {
      download: downloadFileName(tender?.title ?? null, document.doc_type),
    })

  if (signError || !signed?.signedUrl) {
    return NextResponse.json(
      { error: 'That document could not be prepared for download.' },
      { status: 502 },
    )
  }

  // 302 rather than 307: this is a one-off redirect to a URL that expires, and it
  // must never be cached by a browser or a proxy.
  return NextResponse.redirect(signed.signedUrl, {
    status: 302,
    headers: { 'cache-control': 'no-store, max-age=0' },
  })
}
