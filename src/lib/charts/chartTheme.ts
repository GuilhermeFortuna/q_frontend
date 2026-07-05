/**
 * Shared chart frame theme (WO198) — single source of truth for recharts + visx.
 * Grids/axes are furniture; series palette follows gold/brass → silver ramp;
 * pos/neg align with StatTile tones (emerald-400 / rose-400).
 */

export const chartTheme = {
  margin: { top: 8, right: 16, left: 8, bottom: 0 },
  axis: {
    /** white @ 10% — furniture hairline */
    stroke: 'rgba(255, 255, 255, 0.10)',
    tick: {
      fill: 'var(--color-silver-400)',
      fontSize: 10.5,
      fontVariantNumeric: 'tabular-nums slashed-zero',
    },
    tickLine: false as const,
    axisLine: false as const,
  },
  grid: {
    /** white @ 4.5% — solid hairlines, not dashed defaults */
    stroke: 'rgba(255, 255, 255, 0.045)',
    dash: undefined as string | undefined,
  },
  crosshair: {
    /** cream/brass family — WO198 brass crosshair */
    stroke: 'rgba(214, 178, 120, 0.35)',
    strokeDasharray: '4 3',
  },
  baseline: {
    /** brass tier-1 zero-line (equity initial capital, etc.) */
    stroke: 'rgba(255, 202, 71, 0.55)',
    strokeDasharray: '4 4',
    labelFill: 'var(--color-silver-300)',
  },
  series: {
    /** Ordered categorical ramp — gold/brass first, then silver/steel */
    palette: [
      'var(--color-gold-400)',
      'var(--color-brass-500)',
      'var(--color-cream-300)',
      'var(--color-silver-300)',
      'var(--color-silver-400)',
      'var(--color-brass-600)',
    ] as const,
    primary: 'var(--color-gold-400)',
    secondary: 'var(--color-brass-500)',
    muted: 'var(--color-silver-300)',
  },
  semantic: {
    /** StatTile `up` — tailwind emerald-400 */
    positive: '#34d399',
    /** StatTile `down` — tailwind rose-400 */
    negative: '#fb7185',
    equity: 'var(--color-brass-500)',
    drawdown: '#fb7185',
    reference: 'var(--color-silver-300)',
  },
  candle: {
    /** Semantic bull/bear — unchanged meaning, centralized to prevent drift */
    bull: '#26a69a',
    bear: '#ef5350',
    brass: 'var(--color-brass-500)',
  },
  focus: {
    dimOpacity: 0.45,
  },
  tooltip: {
    shellClass: 'surface-float surface-float--blur chart-tooltip rounded-lg px-3 py-2',
    labelClass: 'text-silver-400 text-xs',
    valueClass: 'text-silver-100 font-mono tabular-nums text-xs',
    nameClass: 'text-silver-300 text-xs',
  },
} as const

/** @deprecated Prefer chartTheme — kept for data-prep helpers during migration */
export const chartLegacyColors = {
  grid: chartTheme.grid.stroke,
  axis: chartTheme.axis.tick.fill,
  equity: chartTheme.semantic.equity,
  drawdown: chartTheme.semantic.drawdown,
  positive: chartTheme.semantic.positive,
  negative: chartTheme.semantic.negative,
  reference: chartTheme.semantic.reference,
  tooltipBg: 'transparent',
  tooltipBorder: 'transparent',
} as const

export type ChartTheme = typeof chartTheme
