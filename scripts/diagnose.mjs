/**
 * Read-only health check: what is actually configured, what is actually in the
 * database, and whether the pipeline can run for one test user.
 *
 * Writes nothing. Run with:
 *   node scripts/diagnose.mjs [email]
 */

import { createClient } from '@supabase/supabase-js'

import { loadEnv } from './load-env.mjs'

loadEnv()

const TEST_EMAIL = (process.argv[2] ?? 'brian@yagwatech.com').toLowerCase()

const pass = (m) => console.log(`  PASS  ${m}`)
const fail = (m) => console.log(`  FAIL  ${m}`)
const warn = (m) => console.log(`  WARN  ${m}`)
const info = (m) => console.log(`  ..    ${m}`)

function section(title) {
  console.log(`\n=== ${title} ===`)
}

let failures = 0
function check(ok, okMessage, failMessage, soft = false) {
  if (ok) {
    pass(okMessage)
  } else if (soft) {
    warn(failMessage)
  } else {
    fail(failMessage)
    failures++
  }
  return ok
}

// ---------------------------------------------------------------------------
section('Environment')

const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SITE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'XAI_API_KEY',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'CRON_SECRET',
]

const OPTIONAL = [
  'GROK_MODEL',
  'TENDER_SOURCES',
  'TENDER_MATCH_THRESHOLD',
  'PAYSTACK_SECRET_KEY',
  'NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY',
  'PAYSTACK_PLAN_CODE',
  'TEXTSMS_API_KEY',
  'TEXTSMS_PARTNER_ID',
  'TEXTSMS_SENDER_ID',
  'ADMIN_NOTIFICATION_EMAIL',
]

for (const key of REQUIRED) {
  check(
    Boolean(process.env[key]?.trim()),
    `${key} set`,
    `${key} is missing — the pipeline cannot run without it`,
  )
}

for (const key of OPTIONAL) {
  const value = process.env[key]?.trim()
  info(`${key} = ${value ? (key.includes('KEY') || key.includes('SECRET') ? 'set' : value) : '(unset)'}`)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.log('\nCannot continue without Supabase credentials.')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ---------------------------------------------------------------------------
section('Schema / migrations')

async function columnsOf(table, columns) {
  const { error } = await admin.from(table).select(columns).limit(1)
  return error
}

const schemaChecks = [
  ['companies', 'id, name, domain, plan, trial_ends_at, industry, sectors_of_interest, region, company_size', 'migrations 0001-0004'],
  ['companies', 'paystack_customer_code, paystack_subscription_code', 'migration 0007'],
  ['representatives', 'id, company_id, email, full_name, phone_number', 'migration 0007'],
  ['tenders_matched', 'id, company_id, title, source_url, deadline, summary, match_score, procuring_entity, status, notified_at', 'migration 0005'],
  ['tender_documents', 'id, tender_id, doc_type, storage_path', 'migration 0006'],
  ['subscriptions', 'id, company_id, paystack_reference, event_type', 'migration 0007'],
]

for (const [table, columns, origin] of schemaChecks) {
  const error = await columnsOf(table, columns)
  check(!error, `${table} (${origin})`, `${table} (${origin}): ${error?.message}`)
}

// RPCs
const rpcChecks = [
  ['company_signup_status', { p_domain: 'example.com' }],
  ['pending_tender_drafts', { p_limit: 1 }],
]

for (const [name, args] of rpcChecks) {
  const { data, error } = await admin.rpc(name, args)
  check(!error, `rpc ${name}() callable`, `rpc ${name}(): ${error?.message}`)

  if (name === 'pending_tender_drafts' && !error) {
    const row = Array.isArray(data) ? data[0] : null
    if (row) {
      check(
        'representative_phones' in row,
        'pending_tender_drafts returns representative_phones (SMS wired)',
        'pending_tender_drafts has no representative_phones column — migration 0007 RPC replacement not applied, SMS will never send',
        true,
      )
    } else {
      info('pending_tender_drafts returned no rows, cannot inspect its shape')
    }
  }
}

// Storage bucket
const { data: buckets, error: bucketError } = await admin.storage.listBuckets()
if (bucketError) {
  fail(`storage.listBuckets: ${bucketError.message}`)
  failures++
} else {
  const bucket = buckets.find((b) => b.name === 'tender-documents')
  check(
    Boolean(bucket),
    `storage bucket "tender-documents" exists (public=${bucket?.public})`,
    'storage bucket "tender-documents" is missing — migration 0006 not applied',
  )
}

// ---------------------------------------------------------------------------
section(`Test user: ${TEST_EMAIL}`)

const { data: userList, error: userError } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
})

if (userError) {
  fail(`auth.admin.listUsers: ${userError.message}`)
  failures++
  process.exit(1)
}

const authUser = userList.users.find((u) => u.email?.toLowerCase() === TEST_EMAIL)

if (!check(Boolean(authUser), `auth user exists (${authUser?.id})`, `no auth user with email ${TEST_EMAIL}`)) {
  info(`Existing auth users: ${userList.users.map((u) => u.email).join(', ') || '(none)'}`)
  console.log(`\n${failures} check(s) failed.`)
  process.exit(1)
}

check(
  Boolean(authUser.email_confirmed_at),
  `email confirmed at ${authUser.email_confirmed_at}`,
  'email is not confirmed — sign-in will be rejected',
  true,
)
info(`user_metadata: ${JSON.stringify(authUser.user_metadata)}`)

const { data: rep, error: repError } = await admin
  .from('representatives')
  .select('id, company_id, email, full_name, phone_number, created_at')
  .eq('id', authUser.id)
  .maybeSingle()

if (repError) {
  fail(`representatives lookup: ${repError.message}`)
  failures++
}

if (!check(Boolean(rep), `representative row exists`, 'no representatives row — complete_onboarding() never ran for this user')) {
  console.log(`\n${failures} check(s) failed.`)
  process.exit(1)
}

info(`full_name=${rep.full_name} phone_number=${rep.phone_number ?? '(none)'}`)

const { data: company, error: companyError } = await admin
  .from('companies')
  .select('*')
  .eq('id', rep.company_id)
  .maybeSingle()

if (companyError) {
  fail(`companies lookup: ${companyError.message}`)
  failures++
}

if (!check(Boolean(company), 'company row exists', 'representative points at no company')) {
  console.log(`\n${failures} check(s) failed.`)
  process.exit(1)
}

info(`name=${company.name} domain=${company.domain} plan=${company.plan} trial_ends_at=${company.trial_ends_at}`)
info(`industry=${company.industry ?? '(null)'}`)
info(`sectors_of_interest=${JSON.stringify(company.sectors_of_interest)}`)
info(`region=${company.region ?? '(null)'} company_size=${company.company_size ?? '(null)'}`)

const profileUsable = Boolean(
  company.industry?.trim() ||
    (company.sectors_of_interest && company.sectors_of_interest.length > 0),
)

check(
  profileUsable,
  'matching profile is usable, discovery will score for this company',
  'matching profile is empty — runDiscovery() SKIPS this company entirely (onboarding unfinished)',
)

const trialEnds = company.trial_ends_at ? new Date(company.trial_ends_at) : null
if (trialEnds) {
  const daysLeft = Math.ceil((trialEnds.getTime() - Date.now()) / 86_400_000)
  check(
    company.plan === 'paid' || daysLeft > 0,
    `access ok (plan=${company.plan}, ${daysLeft} trial day(s) left)`,
    `trial expired ${-daysLeft} day(s) ago and plan=${company.plan} — dashboard will redirect to /upgrade`,
    true,
  )
}

// ---------------------------------------------------------------------------
section('Existing pipeline data for this company')

const { data: matches, error: matchError } = await admin
  .from('tenders_matched')
  .select('id, title, match_score, status, notified_at, deadline, created_at')
  .eq('company_id', company.id)
  .order('match_score', { ascending: false })

if (matchError) {
  fail(`tenders_matched: ${matchError.message}`)
  failures++
} else {
  info(`${matches.length} matched tender(s)`)
  for (const m of matches.slice(0, 10)) {
    const { count } = await admin
      .from('tender_documents')
      .select('id', { count: 'exact', head: true })
      .eq('tender_id', m.id)

    info(
      `  score=${m.match_score} docs=${count ?? 0} notified=${m.notified_at ? 'yes' : 'NO'} ` +
        `deadline=${m.deadline} "${String(m.title).slice(0, 60)}"`,
    )
  }
}

// ---------------------------------------------------------------------------
section('Outbound services')

// Grok: cheapest possible real call.
try {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.XAI_API_KEY.trim()}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.GROK_MODEL?.trim() || 'grok-4.6',
      messages: [
        { role: 'system', content: 'Reply with JSON only.' },
        { role: 'user', content: 'Return {"ok":true}' },
      ],
      max_tokens: 32,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(30_000),
  })

  const payload = await response.json().catch(() => null)

  check(
    response.ok,
    `xAI Grok reachable, model ${process.env.GROK_MODEL?.trim() || 'grok-4.6'} accepted`,
    `xAI Grok rejected the request: ${payload?.error?.message ?? `HTTP ${response.status}`}`,
  )
} catch (error) {
  fail(`xAI Grok unreachable: ${error.message}`)
  failures++
}

// Resend: verify the key and the sender domain without sending.
try {
  const response = await fetch('https://api.resend.com/domains', {
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}` },
    signal: AbortSignal.timeout(15_000),
  })
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    fail(`Resend rejected the API key: ${payload?.message ?? `HTTP ${response.status}`}`)
    failures++
  } else {
    const from = process.env.RESEND_FROM_EMAIL.trim()
    const fromDomain = from.replace(/^.*<|>.*$/g, '').split('@')[1]?.toLowerCase()
    const domains = payload?.data ?? []

    info(`RESEND_FROM_EMAIL sender domain = ${fromDomain}`)
    info(
      `Resend domains: ${
        domains.map((d) => `${d.name} (${d.status})`).join(', ') || '(none registered)'
      }`,
    )

    const verified = domains.find(
      (d) => d.name?.toLowerCase() === fromDomain && d.status === 'verified',
    )

    check(
      Boolean(verified),
      `sender domain ${fromDomain} is verified in Resend`,
      `sender domain ${fromDomain} is NOT verified in Resend — sends to anything but the account owner will be rejected`,
      true,
    )
  }
} catch (error) {
  fail(`Resend unreachable: ${error.message}`)
  failures++
}

// TextSMS is optional; just report whether it is configured.
info(
  `TextSMS configured: ${
    process.env.TEXTSMS_API_KEY?.trim() && process.env.TEXTSMS_PARTNER_ID?.trim()
      ? 'yes'
      : 'no'
  }`,
)

console.log(
  `\n${failures === 0 ? 'All hard checks passed.' : `${failures} hard check(s) failed.`}`,
)
process.exit(failures === 0 ? 0 : 1)
