/**
 * Supabase environment configuration, read from .env.local.
 *
 * Both values are NEXT_PUBLIC_ and therefore inlined into the client bundle at
 * build time, which is expected. The anon key is a public credential; row level
 * security is what protects the data, not key secrecy.
 */

export type SupabaseEnv = {
  url: string
  anonKey: string
}

/** Reads the config, returning null if either variable is missing or blank. */
export function readSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) return null

  return { url, anonKey }
}

/**
 * Reads the config, throwing a pointed error if it is missing. Called lazily
 * from the client factories so a missing .env.local surfaces on first use
 * rather than breaking the build.
 */
export function getSupabaseEnv(): SupabaseEnv {
  const env = readSupabaseEnv()

  if (!env) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Copy .env.local.example to .env.local and fill in your project values.',
    )
  }

  return env
}

const DEFAULT_SITE_URL = 'http://localhost:3000'

/**
 * Public origin of this deployment, used to build the email confirmation
 * redirect. Must also be added to the Supabase project Redirect URLs allow
 * list, or confirmation links will be rejected.
 */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim()

  if (raw) return raw.replace(/\/+$/, '')

  const vercelEnv =
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.NEXT_PUBLIC_VERCEL_URL?.trim() ||
    process.env.VERCEL_URL?.trim()

  if (vercelEnv) {
    const formatted = vercelEnv.startsWith('http') ? vercelEnv : `https://${vercelEnv}`
    return formatted.replace(/\/+$/, '')
  }

  return DEFAULT_SITE_URL
}

