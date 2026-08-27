/**
 * End-to-end pipeline verification for one account.
 *
 * Drives the same code the scheduled jobs drive — lib/tender-discovery.ts and
 * lib/tender-documents.ts — scoped to a single company, and checks the result at
 * every stage rather than trusting the run summary. Nine stages:
 *
 *   1. resolve the representative, company and matching profile
 *   2. fetch from the enabled tender sources
 *   3. score against the profile and insert what clears the threshold
 *   4. draft the bid documents
 *   5. confirm the .docx bytes are in private Storage and are a valid archive
 *   6. confirm tender_documents rows point at objects that exist
 *   7. confirm the notification email was accepted by Resend
 *   8. confirm notified_at was stamped, so no duplicate goes out
 *   9. mint a signed download URL, as the dashboard does
 *
 * Usage:
 *   npm run pipeline -- [email] [--reset] [--stub-ai] [--sources=mock] [--keep-notified]
 *
 *   --reset          delete this company's existing matches first, for a clean run
 *   --stub-ai        use the offline deterministic stand-in instead of a provider
 *   --sources=a,b    override TENDER_SOURCES for this run (default: mock)
 *   --keep-notified  do not clear notified_at, so no email is sent
 *
 * Writes to the live database and sends a real email. It is a verification tool
 * for a test account, not something to point at a customer.
 */

import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inflateRawSync } from 'node:zlib'

import { loadEnv } from './load-env.mjs'

loadEnv()

// Imported after loadEnv, because these modules read process.env when called.
const { createAdminClient } = await import('@/lib/supabase/admin')
const { runDiscovery, formatRunSummary } = await import('@/lib/tender-discovery')
const { runDrafting, formatDraftingSummary } = await import('@/lib/tender-documents')
const { aiConfigHint, aiConfigured, aiDescription } = await import('@/lib/ai')
const { STORAGE_BUCKET, DOWNLOAD_URL_TTL_SECONDS, documentLabel } = await import(
  '@/lib/document-types'
)
const { senderIsUnverifiable, RESEND_TEST_SENDER, sendEmail } = await import(
  '@/lib/email/resend'
)
const { buildTenderEmail } = await import('@/lib/email/tender-notification')
const { createStubAiClient, STUB_MODEL } = await import('./stub-ai.mts')

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
const flags = new Set(args.filter((a) => a.startsWith('--')))
const email = (args.find((a) => !a.startsWith('--')) ?? 'brian@yagwatech.com').toLowerCase()

const reset = flags.has('--reset')
const stubAi = flags.has('--stub-ai')
const keepNotified = flags.has('--keep-notified')
const sourcesArg = args.find((a) => a.startsWith('--sources='))?.slice('--sources='.length)

// Default to the mock source: the real portals are slow, sometimes blocked, and
// their contents change between runs, none of which suits a verification pass.
const sourceIds = (sourcesArg ?? 'mock').split(',').map((s) => s.trim()).filter(Boolean)

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

let failures = 0
let stageNumber = 0

function stage(title: string) {
  stageNumber++
  console.log(`\n${'─'.repeat(72)}\nSTAGE ${stageNumber}: ${title}\n${'─'.repeat(72)}`)
}

function pass(message: string) {
  console.log(`  PASS  ${message}`)
}

function fail(message: string) {
  console.log(`  FAIL  ${message}`)
  failures++
}

function warn(message: string) {
  console.log(`  WARN  ${message}`)
}

function info(message: string) {
  console.log(`  ..    ${message}`)
}

function check(ok: boolean, okMessage: string, failMessage: string): boolean {
  if (ok) pass(okMessage)
  else fail(failMessage)

  return ok
}

function bail(message: string): never {
  fail(message)
  console.log(`\n${failures} check(s) failed. Run stopped.`)
  process.exit(1)
}

/** Validates that a buffer really is a readable ZIP with the DOCX parts in it. */
function docxParts(bytes: Buffer): string[] {
  const names: string[] = []
  let offset = 0

  while (offset + 30 <= bytes.length && bytes.readUInt32LE(offset) === 0x04034b50) {
    const compressedSize = bytes.readUInt32LE(offset + 18)
    const nameLength = bytes.readUInt16LE(offset + 26)
    const extraLength = bytes.readUInt16LE(offset + 28)
    const nameStart = offset + 30
    const dataStart = nameStart + nameLength + extraLength
    const name = bytes.subarray(nameStart, nameStart + nameLength).toString('utf8')

    // Inflating proves the entry is not merely declared but actually readable.
    inflateRawSync(bytes.subarray(dataStart, dataStart + compressedSize))
    names.push(name)

    offset = dataStart + compressedSize
  }

  return names
}

// ---------------------------------------------------------------------------
console.log('QUICK TENDERS — END TO END PIPELINE VERIFICATION')
console.log(`Account:  ${email}`)
console.log(`Sources:  ${sourceIds.join(', ')}`)
console.log(
  `AI:       ${
    stubAi
      ? `${STUB_MODEL}  <-- NOT A REAL MODEL, --stub-ai is on`
      : aiConfigured()
        ? aiDescription()
        : `unconfigured (${aiConfigHint()})`
  }`,
)

if (!stubAi && !aiConfigured()) {
  bail(
    'No AI provider is configured, so scoring and drafting cannot run. Set ' +
      'GROQ_API_KEY (or XAI_API_KEY), or re-run with --stub-ai to verify every ' +
      'other stage.',
  )
}

const admin = createAdminClient()

// ---------------------------------------------------------------------------
stage('Account, company and matching profile')

const { data: users, error: usersError } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
})

if (usersError) bail(`Could not list auth users: ${usersError.message}`)

const authUser = users.users.find((u) => u.email?.toLowerCase() === email)

if (!authUser) bail(`No auth user with the email ${email}`)

pass(`auth user ${authUser.id}`)

if (!authUser.email_confirmed_at) {
  warn('email is not confirmed, so this account could not sign in through the UI')
}

const { data: rep, error: repError } = await admin
  .from('representatives')
  .select('id, company_id, email, full_name, phone_number')
  .eq('id', authUser.id)
  .maybeSingle()

if (repError) bail(`representatives lookup failed: ${repError.message}`)
if (!rep) bail('No representatives row, so complete_onboarding() never ran')

pass(`representative ${rep.full_name ?? '(no name)'} <${rep.email}>`)
info(`phone_number: ${rep.phone_number ?? '(none, so no SMS will be sent)'}`)

const { data: company, error: companyError } = await admin
  .from('companies')
  .select('id, name, domain, plan, trial_ends_at, industry, sectors_of_interest, region, company_size')
  .eq('id', rep.company_id)
  .maybeSingle()

if (companyError) bail(`companies lookup failed: ${companyError.message}`)
if (!company) bail('The representative points at no company')

pass(`company ${company.name} (${company.domain}), plan=${company.plan}`)
info(`industry:  ${company.industry ?? '(null)'}`)
info(`sectors:   ${JSON.stringify(company.sectors_of_interest)}`)
info(`region:    ${company.region ?? '(null)'}   size: ${company.company_size ?? '(null)'}`)

check(
  Boolean(
    company.industry?.trim() ||
      (company.sectors_of_interest && company.sectors_of_interest.length > 0),
  ),
  'matching profile is usable, so discovery will score for this company',
  'matching profile is empty — runDiscovery() skips companies with no industry ' +
    'and no sectors, so nothing downstream can run. Finish /onboarding first.',
)

if (failures > 0) {
  console.log(`\n${failures} check(s) failed. Run stopped.`)
  process.exit(1)
}

// ---------------------------------------------------------------------------
if (reset) {
  stage('Reset (--reset)')

  const { data: existing } = await admin
    .from('tenders_matched')
    .select('id')
    .eq('company_id', company.id)

  const ids = (existing ?? []).map((row) => row.id)

  if (ids.length === 0) {
    info('nothing to reset')
  } else {
    // Storage objects are not cascaded by the row delete, so clear them too or the
    // next run uploads over orphans and the check below cannot tell new from old.
    const { data: objects } = await admin.storage
      .from(STORAGE_BUCKET)
      .list(company.id, { limit: 1000 })

    const paths: string[] = []

    for (const folder of objects ?? []) {
      const { data: inner } = await admin.storage
        .from(STORAGE_BUCKET)
        .list(`${company.id}/${folder.name}`, { limit: 1000 })

      for (const file of inner ?? []) {
        paths.push(`${company.id}/${folder.name}/${file.name}`)
      }
    }

    if (paths.length > 0) {
      const { error } = await admin.storage.from(STORAGE_BUCKET).remove(paths)
      if (error) warn(`could not remove ${paths.length} stored object(s): ${error.message}`)
      else pass(`removed ${paths.length} stored object(s)`)
    }

    const { error: deleteError } = await admin
      .from('tenders_matched')
      .delete()
      .eq('company_id', company.id)

    if (deleteError) bail(`could not delete matches: ${deleteError.message}`)

    pass(`deleted ${ids.length} matched tender(s) (tender_documents cascade)`)
  }
}

const aiClient = stubAi ? createStubAiClient() : undefined

// ---------------------------------------------------------------------------
stage('Discovery: fetch sources, score against the profile, insert matches')

const discovery = await runDiscovery({
  sourceIds,
  companyId: company.id,
  client: aiClient,
})

console.log(formatRunSummary(discovery))
console.log()

check(
  discovery.tendersFetched > 0,
  `${discovery.tendersFetched} tender(s) fetched, ${discovery.tendersAfterExpiryFilter} still open`,
  'no tenders were fetched, so there was nothing to score. Check the source statuses above.',
)

check(
  discovery.tendersFetched > discovery.tendersAfterExpiryFilter,
  'the expiry filter dropped at least one closed tender, so it is doing its job',
  'nothing was dropped by the expiry filter — with the mock source this should ' +
    'drop the deliberately expired fixture',
)

const companyRun = discovery.companies.find((c) => c.companyId === company.id)

if (!companyRun) {
  const skipped = discovery.companiesSkipped.find((c) => c.companyId === company.id)
  bail(
    skipped
      ? `the company was skipped: ${skipped.reason}`
      : 'the company appears in neither the scored nor the skipped list',
  )
}

check(
  companyRun.scored > 0,
  `${companyRun.scored} tender(s) scored, top score ${companyRun.topScore}`,
  'nothing was scored for this company',
)

check(
  companyRun.errors.length === 0,
  'scoring produced no errors',
  `scoring errors: ${companyRun.errors.join('; ')}`,
)

info(
  `${companyRun.aboveThreshold} cleared the threshold of ${discovery.threshold}, ` +
    `${companyRun.inserted} inserted, ${companyRun.skippedExisting} already held`,
)

check(
  companyRun.aboveThreshold > 0,
  'at least one tender cleared the match threshold',
  `nothing cleared the threshold of ${discovery.threshold} (top score was ` +
    `${companyRun.topScore}). Lower TENDER_MATCH_THRESHOLD or widen the profile.`,
)

if (stubAi) {
  warn('scores above are keyword overlap from the stub, not model judgement')
}

// ---------------------------------------------------------------------------
stage('Matches as stored')

const { data: matches, error: matchesError } = await admin
  .from('tenders_matched')
  .select('id, title, source_url, deadline, summary, match_score, procuring_entity, status, notified_at')
  .eq('company_id', company.id)
  .order('match_score', { ascending: false })

if (matchesError) bail(`could not read matches: ${matchesError.message}`)
if (!matches || matches.length === 0) bail('no rows in tenders_matched for this company')

pass(`${matches.length} row(s) in tenders_matched`)

for (const match of matches.slice(0, 5)) {
  info(`score ${match.match_score}  status=${match.status}  "${String(match.title).slice(0, 55)}"`)
}

check(
  matches.every((m) => m.status === 'new' || m.status === 'reviewed' || m.status === 'submitted' || m.status === 'expired'),
  'every row has a valid status',
  'a row has a status outside the enum',
)

check(
  matches.every((m) => typeof m.match_score === 'number' && m.match_score >= 0 && m.match_score <= 100),
  'every match_score is within 0-100',
  'a match_score is outside 0-100',
)

check(
  matches.every((m) => Boolean(m.summary)),
  'every row has a summary explaining why it matched',
  'a row has no summary',
)

// Re-running discovery must not duplicate. The unique index is the real guard;
// this proves it is in place.
const rerun = await runDiscovery({ sourceIds, companyId: company.id, client: aiClient })
const rerunCompany = rerun.companies.find((c) => c.companyId === company.id)

check(
  (rerunCompany?.inserted ?? 0) === 0,
  'a second discovery run inserted nothing, so the deduplication holds',
  `a second run inserted ${rerunCompany?.inserted} more row(s) — the unique index ` +
    'on (company_id, source_url) is not doing its job',
)

// ---------------------------------------------------------------------------
// So the notification stage has something to do on a re-run without --reset.
if (!keepNotified) {
  const { error } = await admin
    .from('tenders_matched')
    .update({ notified_at: null })
    .eq('company_id', company.id)
    .not('notified_at', 'is', null)

  if (error) warn(`could not clear notified_at: ${error.message}`)
}

// ---------------------------------------------------------------------------
stage('Drafting: generate the bid documents, store them, email the representative')

const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() ?? ''

if (senderIsUnverifiable(fromEmail)) {
  warn(
    `RESEND_FROM_EMAIL is ${fromEmail}, whose domain can never be verified with ` +
      `Resend. The send will fall back to ${RESEND_TEST_SENDER}, which only ` +
      'reaches the address that owns the Resend account.',
  )
}

const drafting = await runDrafting({
  companyId: company.id,
  limit: 5,
  client: aiClient,
})

console.log(formatDraftingSummary(drafting))
console.log()

check(
  drafting.pending > 0,
  `${drafting.pending} tender(s) were pending documents or a notification`,
  'nothing was pending, so drafting had nothing to do. Re-run with --reset.',
)

check(
  drafting.totals.documentsCreated > 0,
  `${drafting.totals.documentsCreated} document(s) drafted and uploaded`,
  'no documents were created',
)

const draftErrors = drafting.tenders.flatMap((t) => t.errors)

check(
  draftErrors.length === 0 && drafting.errors.length === 0,
  'drafting produced no errors',
  `drafting errors: ${[...drafting.errors, ...draftErrors].join(' | ')}`,
)

// ---------------------------------------------------------------------------
stage('Stored documents: rows, objects, and readable .docx bytes')

const { data: documents, error: documentsError } = await admin
  .from('tender_documents')
  .select('id, tender_id, doc_type, storage_path, created_at')
  .in('tender_id', matches.map((m) => m.id))

if (documentsError) bail(`could not read tender_documents: ${documentsError.message}`)
if (!documents || documents.length === 0) bail('no rows in tender_documents')

pass(`${documents.length} document row(s)`)

const savedLocally: string[] = []

for (const document of documents) {
  const label = documentLabel(document.doc_type)

  check(
    document.storage_path.startsWith(`${company.id}/`),
    `${label}: object path is scoped to the company, which is what the storage policy checks`,
    `${label}: path ${document.storage_path} does not start with the company id`,
  )

  const { data: blob, error: downloadError } = await admin.storage
    .from(STORAGE_BUCKET)
    .download(document.storage_path)

  if (downloadError || !blob) {
    fail(`${label}: the row points at ${document.storage_path} but it could not be downloaded: ${downloadError?.message}`)
    continue
  }

  const bytes = Buffer.from(await blob.arrayBuffer())

  let parts: string[] = []
  try {
    parts = docxParts(bytes)
  } catch (error) {
    fail(`${label}: the stored bytes are not a readable ZIP: ${(error as Error).message}`)
    continue
  }

  const hasAllParts =
    parts.includes('[Content_Types].xml') &&
    parts.includes('_rels/.rels') &&
    parts.includes('word/document.xml')

  check(
    hasAllParts && bytes.length > 500,
    `${label}: ${bytes.length} bytes, a valid DOCX archive with all three parts`,
    `${label}: archive is incomplete, parts found: ${parts.join(', ')}`,
  )

  // Save a copy so the documents can actually be opened and read.
  const local = join(tmpdir(), `quick-tenders-${document.doc_type}-${document.tender_id.slice(0, 8)}.docx`)
  writeFileSync(local, bytes)
  savedLocally.push(local)
}

// ---------------------------------------------------------------------------
stage('Notification: email accepted, and notified_at stamped')

const emailed = drafting.tenders.filter((t) => t.emailed)
const skippedReasons = drafting.tenders.filter((t) => t.skipped).map((t) => t.skipped)
const emailErrors = drafting.tenders.flatMap((t) => t.errors).filter((e) => e.startsWith('Email failed'))

if (emailed.length > 0) {
  pass(`${emailed.length} notification email(s) accepted by Resend`)
  for (const tender of emailed) {
    info(`"${String(tender.title).slice(0, 50)}" -> ${tender.recipients} recipient(s)`)
  }
  info(`recipient address: ${rep.email}`)
} else if (emailErrors.some((e) => /only send testing emails to your own email address/.test(e))) {
  // Expected while RESEND_FROM_EMAIL is a consumer mailbox: the resend.dev test
  // sender is restricted to the account owner. The send path is still worth
  // proving, so the same email is built and sent to the one allowed recipient.
  const owner = emailErrors
    .join(' ')
    .match(/your own email address \(([^)]+)\)/)?.[1]
    ?.trim()

  warn(
    `Resend refused to deliver to ${rep.email}: the test sender only reaches the ` +
      'Resend account owner. This is the sender problem, not a pipeline problem.',
  )

  if (!owner) {
    fail('could not determine the Resend account owner address from the error')
  } else {
    info(`proving the send path instead by emailing the account owner, ${owner}`)

    const top = matches[0]
    const labels = documents
      .filter((d) => d.tender_id === top.id)
      .map((d) => documentLabel(d.doc_type))

    const built = buildTenderEmail({
      tenderId: top.id,
      title: top.title ?? 'Untitled tender',
      procuringEntity: top.procuring_entity,
      deadline: top.deadline,
      matchScore: top.match_score,
      summary: top.summary,
      sourceUrl: top.source_url,
      companyName: company.name,
      representativeName: rep.full_name,
      documentLabels: labels,
    })

    const sent = await sendEmail({
      to: [owner],
      subject: `${built.subject} [pipeline verification]`,
      html: built.html,
      text: built.text,
    })

    check(
      sent.ok,
      `notification email delivered to ${owner} (id ${sent.ok ? sent.id : ''})` +
        `${sent.ok && sent.usedFallbackSender ? `, sent from ${sent.from}` : ''}`,
      `the send path itself is broken: ${sent.ok ? '' : sent.error}`,
    )

    fail(
      `email cannot reach ${rep.email} until a domain you own is verified at ` +
        'resend.com/domains and RESEND_FROM_EMAIL points at an address on it',
    )
  }
} else {
  fail(
    'no notification email was sent' +
      (skippedReasons.length > 0 ? `: ${skippedReasons.join('; ')}` : '') +
      (emailErrors.length > 0 ? `: ${emailErrors.join('; ')}` : ''),
  )
}

const { data: afterNotify } = await admin
  .from('tenders_matched')
  .select('id, notified_at')
  .eq('company_id', company.id)

const stamped = (afterNotify ?? []).filter((m) => m.notified_at !== null).length

check(
  stamped > 0,
  `${stamped} row(s) have notified_at stamped, so no duplicate email goes out next run`,
  'no row has notified_at set, so the next run would email again',
)

// ---------------------------------------------------------------------------
stage('Dashboard download: mint a signed URL for a private object')

const first = documents[0]
const { data: signed, error: signError } = await admin.storage
  .from(STORAGE_BUCKET)
  .createSignedUrl(first.storage_path, DOWNLOAD_URL_TTL_SECONDS)

if (signError || !signed?.signedUrl) {
  fail(`could not mint a signed URL: ${signError?.message}`)
} else {
  pass(`signed URL minted, valid for ${DOWNLOAD_URL_TTL_SECONDS}s`)

  const response = await fetch(signed.signedUrl)

  check(
    response.ok,
    `the signed URL serves the file (HTTP ${response.status}, ${response.headers.get('content-length')} bytes)`,
    `the signed URL did not serve the file: HTTP ${response.status}`,
  )
}

// The bucket must not be readable without a signature.
const unsigned = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${first.storage_path}`
const anonymous = await fetch(unsigned)

check(
  !anonymous.ok,
  `the object is not publicly readable without a signature (HTTP ${anonymous.status})`,
  'the object is readable with no signature — the bucket is public and every ' +
    "tenant's documents are exposed",
)

// ---------------------------------------------------------------------------
console.log(`\n${'═'.repeat(72)}`)

if (savedLocally.length > 0) {
  console.log('Generated documents, saved so you can open them:')
  for (const path of savedLocally) console.log(`  ${path}`)
  console.log()
}

console.log(`Dashboard:  ${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`)
console.log(`Sign in as: ${email}`)

if (stubAi) {
  console.log(
    '\nNOTE: --stub-ai was on. Document text and match scores came from the ' +
      '\n      deterministic stand-in, not a language model. Every other stage ' +
      '\n      above — sources, inserts, DOCX, Storage, email, signed URLs — was real.',
  )
}

console.log(
  `\n${failures === 0 ? `All ${stageNumber} stages passed.` : `${failures} check(s) failed across ${stageNumber} stages.`}`,
)

process.exit(failures === 0 ? 0 : 1)
