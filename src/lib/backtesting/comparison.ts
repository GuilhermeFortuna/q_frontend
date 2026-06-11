import { formatSignedCurrency } from '@/components/backtests/chartUtils'
import { formatDisplayDateTime } from '@/lib/formatDate'
import type {
  BacktestEquityArtifactPoint,
  BacktestMetrics,
  BacktestRunSummary,
} from '@/types/backtesting'

export const COMPARISON_MAX_RUNS = 5

export const COMPARISON_SERIES_COLORS = [
  '#c4a574',
  '#6b9bd1',
  '#4ade80',
  '#f87171',
  '#a78bfa',
] as const

export type ComparisonNormalizeMode = 'percent' | 'absolute'

export type ComparisonMetricDirection = 'higher' | 'lower' | 'neutral'

export type ComparisonMetricRow = {
  key: keyof BacktestMetrics
  label: string
  direction: ComparisonMetricDirection
  format: (value: number) => string
}

export const COMPARISON_METRIC_ROWS: ComparisonMetricRow[] = [
  {
    key: 'total_pnl',
    label: 'Total PnL',
    direction: 'higher',
    format: formatSignedCurrency,
  },
  {
    key: 'win_rate',
    label: 'Win Rate',
    direction: 'higher',
    format: (value) => `${(value * 100).toFixed(1)}%`,
  },
  {
    key: 'profit_factor',
    label: 'Profit Factor',
    direction: 'higher',
    format: (value) => value.toFixed(2),
  },
  {
    key: 'max_drawdown_pct',
    label: 'Max Drawdown',
    direction: 'lower',
    format: (value) => `-${(value * 100).toFixed(2)}%`,
  },
  {
    key: 'total_trades',
    label: 'Total Trades',
    direction: 'neutral',
    format: (value) => String(Math.round(value)),
  },
  {
    key: 'recovery_factor',
    label: 'Recovery Factor',
    direction: 'higher',
    format: (value) => value.toFixed(2),
  },
  {
    key: 'expectancy',
    label: 'Expectancy',
    direction: 'higher',
    format: formatSignedCurrency,
  },
]

export function buildRunComparisonLabel(run: BacktestRunSummary): string {
  return `${run.strategy} · ${run.symbol} · ${run.timeframe} · ${formatDisplayDateTime(run.created_at)}`
}

export function shortRunComparisonLabel(run: BacktestRunSummary): string {
  return `${run.symbol} · ${run.strategy}`
}

export function getMetricValue(
  metrics: BacktestMetrics | null | undefined,
  key: keyof BacktestMetrics,
): number | null {
  if (metrics == null) return null
  const value = metrics[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function isBetterMetricValue(
  candidate: number,
  currentBest: number,
  direction: ComparisonMetricDirection,
): boolean {
  if (direction === 'neutral') return false
  if (direction === 'higher') return candidate > currentBest
  return candidate < currentBest
}

export function findBestMetricRunIndex(
  runs: BacktestRunSummary[],
  key: keyof BacktestMetrics,
  direction: ComparisonMetricDirection,
): number | null {
  if (direction === 'neutral') return null

  let bestIndex: number | null = null
  let bestValue: number | null = null

  runs.forEach((run, index) => {
    const value = getMetricValue(run.summary, key)
    if (value == null) return
    if (bestValue == null || isBetterMetricValue(value, bestValue, direction)) {
      bestValue = value
      bestIndex = index
    }
  })

  return bestIndex
}

export function startingEquityFromPoints(points: BacktestEquityArtifactPoint[]): number | null {
  if (points.length === 0) return null
  return points[0]!.equity
}

export function normalizeEquityPoints(
  points: BacktestEquityArtifactPoint[],
  mode: ComparisonNormalizeMode,
): { time: string; value: number }[] {
  if (points.length === 0) return []

  const startEquity = points[0]!.equity
  if (mode === 'absolute') {
    return points.map((point) => ({ time: point.time, value: point.equity }))
  }

  if (startEquity === 0) {
    return points.map((point) => ({ time: point.time, value: 0 }))
  }

  return points.map((point) => ({
    time: point.time,
    value: ((point.equity - startEquity) / startEquity) * 100,
  }))
}

export function shouldDefaultToPercentNormalization(
  startingCapitals: Array<number | null>,
): boolean {
  const capitals = startingCapitals.filter((value): value is number => value != null)
  if (capitals.length <= 1) return false
  const first = capitals[0]!
  return capitals.some((capital) => capital !== first)
}

export type MergedComparisonChartPoint = {
  time: string
  label: string
} & Record<string, number | string | null>

export function buildMergedComparisonChartData(
  series: Array<{
    runId: string
    points: { time: string; value: number }[]
    visible: boolean
  }>,
): MergedComparisonChartPoint[] {
  const timeSet = new Set<string>()
  for (const item of series) {
    if (!item.visible) continue
    for (const point of item.points) {
      timeSet.add(point.time)
    }
  }

  const sortedTimes = [...timeSet].sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

  return sortedTimes.map((time) => {
    const row: MergedComparisonChartPoint = {
      time,
      label: formatDisplayDateTime(time),
    }

    for (const item of series) {
      if (!item.visible) {
        row[item.runId] = null
        continue
      }
      const match = item.points.find((point) => point.time === time)
      row[item.runId] = match?.value ?? null
    }

    return row
  })
}

export function formatComparisonYAxisValue(value: number, mode: ComparisonNormalizeMode): string {
  if (mode === 'percent') {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
  }
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
}
