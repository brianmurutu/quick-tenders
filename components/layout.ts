/**
 * Shared vertical rhythm for the marketing pages.
 *
 * These were written out per section before, which drifted: three bands stepped
 * 80px to 112px while the trial CTA stepped 80px to 96px, so the rhythm broke on
 * the most important band. The old two-step scale also landed the full 112px at
 * the 640px breakpoint, which is a lot of air for a phone in landscape while the
 * gutters are still only 24px. Every band shares one three-step scale now.
 *
 * Avoid writing literal utility names in comments in this file: Tailwind scans
 * it as plain text and would emit a dead utility for anything that parses as a
 * class.
 */

/** Width and gutters for a full-width band's content. */
export const container = 'mx-auto max-w-6xl px-6 lg:px-8'

/** Vertical padding for a full-width band. */
export const sectionY = 'py-16 sm:py-20 lg:py-28'

/**
 * Gap between a band's heading block and its content. Scales with `sectionY`
 * so the space inside a section stays proportional to the space around it.
 */
export const sectionHeaderGap = 'mt-12 lg:mt-16'
