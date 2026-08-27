import { createClient } from '@supabase/supabase-js'
import { loadEnv } from './load-env.mjs'

loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Supabase credentials missing')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const email = 'brian@yagwatech.com'

async function run() {
  const { data: userList, error: userErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (userErr) {
    console.error('Error listing users:', userErr)
    process.exit(1)
  }

  const authUser = userList.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (!authUser) {
    console.error(`User not found: ${email}`)
    process.exit(1)
  }

  console.log(`Found auth user: ${authUser.id} (${authUser.email})`)

  const { data: rep, error: repErr } = await admin
    .from('representatives')
    .select('id, company_id, email, full_name')
    .eq('id', authUser.id)
    .maybeSingle()

  if (repErr || !rep) {
    console.error('Representative error or not found:', repErr)
    process.exit(1)
  }

  console.log(`Found representative: ${rep.full_name}, company_id: ${rep.company_id}`)

  const { data: companyBefore } = await admin
    .from('companies')
    .select('id, name, domain, plan, trial_ends_at, paystack_subscription_code')
    .eq('id', rep.company_id)
    .single()

  console.log('Company before update:', companyBefore)

  // Set plan to 'trial' and trial_ends_at to 2 days ago so trial is expired
  const expiredDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()

  const { data: companyAfter, error: updateErr } = await admin
    .from('companies')
    .update({
      plan: 'trial',
      trial_ends_at: expiredDate,
      paystack_subscription_code: null,
    })
    .eq('id', rep.company_id)
    .select()
    .single()

  if (updateErr) {
    console.error('Error updating company:', updateErr)
    process.exit(1)
  }

  console.log('Company successfully updated to expired demo/trial:')
  console.log({
    id: companyAfter.id,
    name: companyAfter.name,
    domain: companyAfter.domain,
    plan: companyAfter.plan,
    trial_ends_at: companyAfter.trial_ends_at,
    paystack_subscription_code: companyAfter.paystack_subscription_code,
  })
}

run()
