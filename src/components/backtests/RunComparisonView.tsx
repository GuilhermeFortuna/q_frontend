import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { useBacktestEquityArtifacts } from '@/api/queries/backtests'
import { CHART_COLORS, formatCurrency } from '@/components/backtests/chartUtils'
import { ChartEmptyState } from '@/components/backtests/ChartEmptyState'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui'
import {
  buildMergedComparisonChartData,
  buildRunComparisonLabel,
  COMPARISON_METRIC_ROWS,
  COMPARISON_SERIES_COLORS,
  findBestMetricRunIndex,
  formatComparisonYAxisValue,
  getMetricValue,
  normalizeEquityPoints,
  shouldDefaultToPercentNormalization,
  shortRunComparisonLabel,
  startingEquityFromPoints,
  type ComparisonNormalizeMode,
} from '@/lib/backtesting/comparison'
import { cn } from '@/lib/utils'
import type { BacktestRunSummary } from '@/types/backtesting'

type RunComparisonViewProps = {
  runs: BacktestRunSummary[]
  onClose: () => void
}

export function RunComparisonView({ runs, onClose }: RunComparisonViewProps) {
  const artifactQueries = useBacktestEquityArtifacts(runs.map((run) => run.run_id))
  const [hiddenRunIds, setHiddenRunIds] = useState<Set<string>>(() => new Set())
  const [normalizeMode, setNormalizeMode] = useState<ComparisonNormalizeMode | null>(null)

  const seriesMeta = useMemo(
    () =>
      runs.map((run, index) => {
        const query = artifactQueries[index]
        const points = query?.data?.availability === 'available' ? query.data.points : []
        return {
          run,
          color: COMPARISON_SERIES_COLORS[index % COMPARISON_SERIES_COLORS.length]!,
          points,
          unavailable: query?.data?.availability === 'unavailable',
          loading: query?.isLoading ?? false,
          startingEquity: startingEquityFromPoints(points),
        }
      }),
    [artifactQueries, runs],
  )

  const resolvedNormalizeMode = useMemo(() => {
    if (normalizeMode != null) return normalizeMode
    return shouldDefaultToPercentNormalization(seriesMeta.map((item) => item.startingEquity))
      ? 'percent'
      : 'absolute'
  }, [normalizeMode, seriesMeta])

  const chartSeries = useMemo(
    () =>
      seriesMeta.map((item) => ({
        runId: item.run.run_id,
        label: shortRunComparisonLabel(item.run),
        fullLabel: buildRunComparisonLabel(item.run),
        color: item.color,
        unavailable: item.unavailable,
        visible: !hiddenRunIds.has(item.run.run_id) && !item.unavailable,
        points: normalizeEquityPoints(item.points, resolvedNormalizeMode),
      })),
    [hiddenRunIds, resolvedNormalizeMode, seriesMeta],
  )

  const chartData = useMemo(
    () =>
      buildMergedComparisonChartData(
        chartSeries.map((series) => ({
          runId: series.runId,
          points: series.points,
          visible: series.visible,
        })),
      ),
    [chartSeries],
  )

  const hasVisibleSeries = chartSeries.some((series) => series.visible && series.points.length > 0)

  const toggleSeries = (runId: string) => {
    setHiddenRunIds((current) => {
      const next = new Set(current)
      if (next.has(runId)) {
        next.delete(runId)
      } else {
        next.add(runId)
      }
      return next
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mb-4 flex shrink-0 items-start justify-between gap-4">
        <div>
          <h3 className="text-silver-100 text-lg font-semibold">Compare runs</h3>
          <p className="text-silver-400 mt-1 text-sm">
            Overlay up to {runs.length} saved backtests on a shared timeline.
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Back to history
        </Button>
      </div>

      <div className="border-carbon-600/40 mb-4 flex shrink-0 flex-wrap items-center gap-2 rounded-lg border bg-transparent p-3">
        <span className="text-silver-400 text-xs tracking-wide uppercase">Scale</span>
        <Button
          type="button"
          size="sm"
          variant={resolvedNormalizeMode === 'percent' ? 'brass' : 'ghost'}
          onClick={() => setNormalizeMode('percent')}
        >
          % Return
        </Button>
        <Button
          type="button"
          size="sm"
          variant={resolvedNormalizeMode === 'absolute' ? 'brass' : 'ghost'}
          onClick={() => setNormalizeMode('absolute')}
        >
          Absolute equity
        </Button>
      </div>

      <div className="border-carbon-600/40 mb-4 flex min-h-[280px] shrink-0 flex-col rounded-lg border bg-transparent p-4">
        <h4 className="text-silver-200 mb-3 text-sm font-medium">Equity curves</h4>
        {!hasVisibleSeries ? (
          <ChartEmptyState message="No equity artifacts available for the selected runs. Metrics below still reflect stored summaries." />
        ) : (
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: CHART_COLORS.grid }}
                  minTickGap={48}
                />
                <YAxis
                  tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) =>
                    formatComparisonYAxisValue(value, resolvedNormalizeMode)
                  }
                  width={72}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: CHART_COLORS.tooltipBg,
                    border: `1px solid ${CHART_COLORS.tooltipBorder}`,
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  formatter={(value: number, _name: string, item) => {
                    const series = chartSeries.find((entry) => entry.runId === item.dataKey)
                    if (!series || value == null) return ['—', series?.label ?? '']
                    if (resolvedNormalizeMode === 'percent') {
                      return [`${value >= 0 ? '+' : ''}${value.toFixed(2)}%`, series.label]
                    }
                    return [formatCurrency(value), series.label]
                  }}
                />
                <Legend
                  onClick={(payload) => {
                    const runId = String(payload.dataKey ?? '')
                    if (runId) toggleSeries(runId)
                  }}
                  formatter={(value, entry) => {
                    const series = chartSeries.find((item) => item.runId === entry.dataKey)
                    if (!series) return value
                    if (series.unavailable) return `${series.label} (no curve — pre-artifact run)`
                    if (!series.visible) return `${series.label} (hidden)`
                    return series.label
                  }}
                />
                {chartSeries.map((series) => (
                  <Line
                    key={series.runId}
                    type="monotone"
                    dataKey={series.runId}
                    name={series.label}
                    stroke={series.color}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    hide={!series.visible}
                    strokeOpacity={series.visible ? 1 : 0.25}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {chartSeries.map((series) => (
            <button
              key={series.runId}
              type="button"
              onClick={() => !series.unavailable && toggleSeries(series.runId)}
              disabled={series.unavailable}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs transition-colors',
                series.unavailable
                  ? 'border-carbon-600/60 text-silver-500 cursor-not-allowed'
                  : series.visible
                    ? 'border-carbon-500/80 text-silver-100 hover:border-brass-400/60'
                    : 'border-carbon-700/80 text-silver-500 line-through',
              )}
              title={series.fullLabel}
            >
              <span
                className="mr-1.5 inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: series.unavailable ? CHART_COLORS.axis : series.color }}
              />
              {series.unavailable ? `${series.label} · no curve` : series.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <h4 className="text-silver-200 mb-3 text-sm font-medium">Metrics</h4>
        <Table className="min-w-full text-sm">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-3 py-2 text-left font-medium">Metric</TableHead>
              {runs.map((run) => (
                <TableHead key={run.run_id} className="px-3 py-2 text-right font-medium">
                  <span className="block truncate" title={buildRunComparisonLabel(run)}>
                    {shortRunComparisonLabel(run)}
                  </span>
                  <span className="text-silver-500 block text-xs font-normal">{run.timeframe}</span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {COMPARISON_METRIC_ROWS.map((row) => {
              const bestIndex = findBestMetricRunIndex(runs, row.key, row.direction)
              return (
                <TableRow key={row.key}>
                  <TableCell className="text-silver-300 px-3 py-2">{row.label}</TableCell>
                  {runs.map((run, index) => {
                    const value = getMetricValue(run.summary, row.key)
                    const isBest = bestIndex === index && value != null
                    return (
                      <TableCell
                        key={run.run_id}
                        className={cn(
                          'px-3 py-2 text-right tabular-nums',
                          isBest
                            ? 'bg-emerald-500/10 font-medium text-emerald-300'
                            : 'text-silver-100',
                        )}
                      >
                        {value == null ? '—' : row.format(value)}
                      </TableCell>
                    )
                  })}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
