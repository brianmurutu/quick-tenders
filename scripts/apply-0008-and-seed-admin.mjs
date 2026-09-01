// Applies migration 0008 and seeds the admin user.
// Run: node scripts/apply-0008-and-seed-admin.mjs

import { readFile } from 'fs/promises'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://okuxrflqfgjlnbcewyzj.supabase.co'
const SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rdXhyZmxxZmdqbG5iY2V3eXpqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Nzc2ODk2NywiZXhwIjoyMTAzMzQ0OTY3fQ.oClIE4QW3_P5VGd8dZxSbSfM1gzDCvPUm8Xm8imFHIo'

// Read the SQL migration
const sql = await readFile('supabase/migrations/0008_admin_notifications.sql', 'utf8')

// Use the Supabase Management API to execute SQL
// This requires the project ref, which is the subdomain of the URL
const projectRef = 'okuxrflqfgjlnbcewyzj'

console.log('Applying migration 0008 via Management API...')
const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${SERVICE_KEY}`,
  },
  body: JSON.stringify({ query: sql }),
})

const text = await res.text()
console.log('Migration response:', res.status, text.slice(0, 300))

if (!res.ok) {
  console.log('\nManagement API not available with service role key.')
  console.log('You need to apply the migration manually in the Supabase Dashboard.')
  console.log('\n--- COPY THIS SQL INTO SUPABASE SQL EDITOR ---')
  console.log(sql.slice(0, 200) + '...')
  process.exit(1)
}

console.log('Migration applied!')

// Now insert the admin user
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const uid = '3e05df1b-a4c0-411b-b6ff-b83603f53a69'
const { error } = await supabase
  .from('admin_users')
  .insert({ id: uid, full_name: 'Quick Tenders Admin', email: 'quicktenders.ke@gmail.com' })

if (error) {
  console.error('admin_users insert error:', error.message)
} else {
  console.log('Admin user seeded successfully!')
}
