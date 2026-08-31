/**
 * A single metric tile for the admin dashboard.
 *
 * Kept deliberately simple: a label, a large count, and an optional sub-label
 * for a secondary stat (e.g. "last 30 days"). No client JS.
 */
export function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: number | string
  sub?: string
  /** Optional colour accent for the value. Defaults to slate-900. */
  accent?: 'blue' | 'green' | 'amber' | 'red'
}) {
  const accentClass =
    accent === 'blue'
      ? 'text-blue-700'
      : accent === 'green'
        ? 'text-emerald-700'
        : accent === 'amber'
          ? 'text-amber-700'
          : accent === 'red'
            ? 'text-red-700'
            : 'text-slate-900'

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${accentClass}`}>{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-400">{sub}</p> : null}
    </div>
  )
}
