/**
 * Minimal .env.local loader for the standalone scripts in this folder.
 *
 * Next.js loads .env.local itself, but these scripts run under plain `node`, so
 * they need the file read into process.env before anything in lib/ is imported.
 * Values already present in the real environment win, matching Next's ordering.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

export function loadEnv(file = '.env.local') {
  let raw

  try {
    raw = readFileSync(resolve(root, file), 'utf8')
  } catch {
    return 0
  }

  let loaded = 0

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#')) continue

    const eq = trimmed.indexOf('=')

    if (eq <= 0) continue

    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()

    // Strip a single layer of matching quotes, as dotenv does.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (process.env[key] === undefined) {
      process.env[key] = value
      loaded++
    }
  }

  return loaded
}

export { root as projectRoot }
