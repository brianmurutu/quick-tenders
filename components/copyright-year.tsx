'use client'

import { useEffect, useState } from 'react'

/**
 * These pages are statically prerendered, so a year computed on the server is
 * captured at build time and would read as stale after New Year until the next
 * deploy. Render the build value first so hydration matches, then correct it on
 * mount from the viewer clock.
 */
export function CopyrightYear({ initialYear }: { initialYear: number }) {
  const [year, setYear] = useState(initialYear)

  useEffect(() => {
    const current = new Date().getFullYear()
    if (current !== initialYear) setYear(current)
  }, [initialYear])

  return <>{year}</>
}
