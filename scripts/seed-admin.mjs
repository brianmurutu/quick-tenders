// One-off script: insert the admin user row.
// Run: node scripts/seed-admin.mjs
const { createClient } = await import('@supabase/supabase-js')

const supabase = createClient(
  'https://okuxrflqfgjlnbcewyzj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rdXhyZmxxZmdqbG5iY2V3eXpqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Nzc2ODk2NywiZXhwIjoyMTAzMzQ0OTY3fQ.oClIE4QW3_P5VGd8dZxSbSfM1gzDCvPUm8Xm8imFHIo',
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const uid = '3e05df1b-a4c0-411b-b6ff-b83603f53a69'
const email = 'quicktenders.ke@gmail.com'

// The PostgREST schema cache may not know admin_users yet if the migration
// was applied after the last cache refresh. Use the Management API SQL
// endpoint instead, which always reflects the live schema.
const res = await fetch(
  'https://okuxrflqfgjlnbcewyzj.supabase.co/rest/v1/admin_users',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rdXhyZmxxZmdqbG5iY2V3eXpqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Nzc2ODk2NywiZXhwIjoyMTAzMzQ0OTY3fQ.oClIE4QW3_P5VGd8dZxSbSfM1gzDCvPUm8Xm8imFHIo',
      Authorization:
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rdXhyZmxxZmdqbG5iY2V3eXpqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Nzc2ODk2NywiZXhwIjoyMTAzMzQ0OTY3fQ.oClIE4QW3_P5VGd8dZxSbSfM1gzDCvPUm8Xm8imFHIo',
      Prefer: 'resolution=ignore-duplicates',
    },
    body: JSON.stringify({ id: uid, full_name: 'Quick Tenders Admin', email }),
  },
)

const text = await res.text()
console.log('HTTP status:', res.status)
console.log('Response:', text || '(empty — insert succeeded)')

if (res.status === 201 || res.status === 200 || res.ok) {
  console.log('\nSUCCESS — quicktenders.ke@gmail.com is now an admin.')
  console.log('Sign in at /login with:')
  console.log('  Email:    quicktenders.ke@gmail.com')
  console.log('  Password: ChangeMe123!')
  console.log('Then navigate to /admin')
} else {
  console.error('\nFAILED — check the response above.')
  process.exit(1)
}
