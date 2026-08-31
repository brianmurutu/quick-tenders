/**
 * Pure SVG line-chart sparkline. No client JS, no charting library.
 *
 * Renders a polyline scaled to fit the given width × height viewport.
 * Each element of `points` is a non-negative number; the component normalises
 * them to the SVG coordinate space.
 *
 * Usage:
 *   <SvgSparkline points={[4, 7, 3, 12, 8]} width={120} height={32} color="blue" />
 */
export function SvgSparkline({
  points,
  width = 120,
  height = 32,
  color = 'blue',
  strokeWidth = 1.5,
}: {
  points: number[]
  width?: number
  height?: number
  color?: 'blue' | 'green' | 'amber' | 'red' | 'slate'
  strokeWidth?: number
}) {
  if (points.length < 2) {
    // Not enough data for a line; render a muted placeholder.
    return (
      <svg
        width={width}
        height={height}
        aria-hidden="true"
        className="shrink-0"
        viewBox={`0 0 ${width} ${height}`}
      >
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
          strokeDasharray="4 3"
        />
      </svg>
    )
  }

  const max = Math.max(...points, 1) // avoid division by zero
  const min = 0

  const pad = strokeWidth
  const drawWidth = width - pad * 2
  const drawHeight = height - pad * 2

  const coords = points.map((val, i) => {
    const x = pad + (i / (points.length - 1)) * drawWidth
    const y = pad + drawHeight - ((val - min) / (max - min)) * drawHeight
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const STROKE: Record<string, string> = {
    blue: '#3b82f6',
    green: '#10b981',
    amber: '#f59e0b',
    red: '#ef4444',
    slate: '#94a3b8',
  }

  const FILL: Record<string, string> = {
    blue: '#dbeafe',
    green: '#d1fae5',
    amber: '#fef3c7',
    red: '#fee2e2',
    slate: '#f1f5f9',
  }

  // Area fill: close the polygon along the bottom edge.
  const areaCoords = [
    `${pad.toFixed(1)},${(pad + drawHeight).toFixed(1)}`,
    ...coords,
    `${(pad + drawWidth).toFixed(1)},${(pad + drawHeight).toFixed(1)}`,
  ].join(' ')

  return (
    <svg
      width={width}
      height={height}
      aria-hidden="true"
      className="shrink-0"
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* Gradient area under the line */}
      <polygon points={areaCoords} fill={FILL[color] ?? FILL.blue} opacity={0.5} />
      {/* The line itself */}
      <polyline
        points={coords.join(' ')}
        fill="none"
        stroke={STROKE[color] ?? STROKE.blue}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * A row of coloured status dots for scrape-run sparklines.
 * Each dot is coloured by its status: green=success, amber=partial, red=failed.
 */
export function StatusDots({ statuses }: { statuses: ('success' | 'partial' | 'failed')[] }) {
  const DOT_COLOR: Record<string, string> = {
    success: '#10b981',
    partial: '#f59e0b',
    failed: '#ef4444',
  }

  return (
    <svg width={statuses.length * 10} height={12} aria-hidden="true" className="shrink-0">
      {statuses.map((status, i) => (
        <circle key={i} cx={i * 10 + 4} cy={6} r={4} fill={DOT_COLOR[status] ?? '#94a3b8'} />
      ))}
    </svg>
  )
}
