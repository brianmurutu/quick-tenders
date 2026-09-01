import { createClient } from '@supabase/supabase-js'

const url = 'https://okuxrflqfgjlnbcewyzj.supabase.co'
const serviceRoleKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rdXhyZmxxZmdqbG5iY2V3eXpqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Nzc2ODk2NywiZXhwIjoyMTAzMzQ0OTY3fQ.oClIE4QW3_P5VGd8dZxSbSfM1gzDCvPUm8Xm8imFHIo'

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const targetEmail = 'brian@mylife.mku.ac.ke'

console.log(`Checking status for ${targetEmail}...`)

// 1. Check in auth.users
const { data: usersData, error: listError } = await supabase.auth.admin.listUsers()
if (listError) {
  console.error('Failed to list users:', listError)
  process.exit(1)
}

const user = usersData.users.find(
  (u) => u.email?.toLowerCase() === targetEmail.toLowerCase() || u.email?.includes('mku.ac.ke'),
)

if (!user) {
  console.log(`No auth user found matching ${targetEmail}.`)
  console.log('Registered users:', usersData.users.map((u) => u.email))
} else {
  console.log('\n--- Auth User Found ---')
  console.log('ID:', user.id)
  console.log('Email:', user.email)
  console.log('Email confirmed at:', user.email_confirmed_at)
  console.log('Metadata:', user.user_metadata)

  // 2. Check representative & company
  const { data: rep } = await supabase
    .from('representatives')
    .select('id, company_id, full_name, email')
    .eq('id', user.id)
    .maybeSingle()

  console.log('\n--- Representative Record ---')
  console.log('Representative:', rep || 'None found (onboarding incomplete)')

  const domain = user.email.split('@')[1]
  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('domain', domain)
    .maybeSingle()

  console.log('\n--- Company Record ---')
  console.log('Company for domain', domain, ':', company || 'None found')

  // 3. Fix / complete onboarding if missing
  let compId = company?.id
  if (!compId) {
    console.log('\nCreating company record...')
    const { data: newComp, error: compErr } = await supabase
      .from('companies')
      .insert({
        name: user.user_metadata?.company_name || domain,
        domain: domain,
        industry: user.user_metadata?.industry || null,
        sectors_of_interest: user.user_metadata?.sectors_of_interest || null,
      })
      .select('id')
      .single()

    if (compErr) {
      console.error('Error creating company:', compErr)
    } else {
      compId = newComp.id
      console.log('Company created successfully with ID:', compId)
    }
  }

  if (compId && !rep) {
    console.log('\nCreating representative link...')
    const { error: repErr } = await supabase
      .from('representatives')
      .insert({
        id: user.id,
        company_id: compId,
        full_name: user.user_metadata?.full_name || 'Brian Murutu',
        email: user.email,
      })

    if (repErr) {
      console.error('Error creating representative:', repErr)
    } else {
      console.log('Representative record linked successfully!')
    }
  }

  // 4. Resend auth confirmation email with Vercel URL
  console.log('\nGenerating new direct magiclink / confirmation link...')
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email,
    options: {
      redirectTo: 'https://quick-tenders.vercel.app/auth/callback',
    },
  })

  if (linkErr) {
    console.error('Error generating link:', linkErr)
  } else {
    console.log('DIRECT LOGIN/CONFIRMATION LINK:')
    console.log(linkData.properties.action_link)
  }
}
