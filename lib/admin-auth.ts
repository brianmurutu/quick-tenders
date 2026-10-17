import type { SupabaseServerClient } from '@/lib/supabase/server'

export async function isAdminUser(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('[auth] Could not verify admin access:', error.message)
    throw new Error('Could not verify account access.')
  }

  return Boolean(data)
}
