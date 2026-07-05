import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Cell, ComposedChart, Line, ResponsiveContainer, Scatter } from 'recharts'

import { cn } from '@/lib/utils'
import { chartTheme } from '@/lib/charts/chartTheme'
import {
  ThemedCartesianGrid,
  ThemedTooltip,
  ThemedXAxis,
  ThemedYAxis,
  chartMargin,
  scatterTooltipFormatter,
} from '@/lib/charts/rechartsTheme'
import type { OptimizationAnalytics } from '@/types/optimization'

const CHART_MIN_HEIGHT_PX = 280

type ScatterDatum = {
  x: number
  y: number
  n: number
  kind: 'background' | 'frontier' | 'best'
}

type ParetoFrontPanelProps = {
  analytics: OptimizationAnalytics
  selectedTrialNumber?: number | null
  onSelectTrial?: (trialNumber: number | null) => void
  className?: string
}

export function ParetoFrontPanel({
  analytics,
  selectedTrialNumber,
  onSelectTrial,
  className,
}: ParetoFrontPanelProps) {
  const pareto = analytics.pareto_front
  const rows = analytics.parallel_coordinate.rows
  const frontierNumbers = useMemo(
    () => new Set(pareto.points.map((point) => point.number)),
    [pareto.points],
  )

  const chart = useMemo(() => {
    if (pareto.is_multi_objective) {
      const background = rows.map((row) => ({
        x: row.values[0] ?? 0,
        y: row.values[1] ?? 0,
        n: row.number,
        kind: 'background' as const,
      }))
      const frontier = [...pareto.points]
        .sort((a, b) => (a.values[0] ?? 0) - (b.values[0] ?? 0))
        .map((point) => ({
          x: point.values[0] ?? 0,
          y: point.values[1] ?? 0,
          n: point.number,
          kind: 'frontier' as const,
        }))
      return {
        mode: 'multi' as const,
        xLabel: pareto.objectives[0] ?? 'Objective 1',
        yLabel: pareto.objectives[1] ?? 'Objective 2',
        background,
        frontier,
        line: frontier,
      }
    }

    const bestNumber = pareto.points[0]?.number
    const points: ScatterDatum[] = rows.map((row) => ({
      x: row.number,
      y: row.values[0] ?? 0,
      n: row.number,
      kind: row.number === bestNumber ? 'best' : 'background',
    }))

    return {
      mode: 'single' as const,
      xLabel: 'Trial',
      yLabel: pareto.objectives[0] ?? 'Objective',
      points,
      bestNumber,
    }
  }, [pareto, rows])

  if (rows.length === 0 && pareto.points.length === 0) {
    return (
      <PanelFrame title="Pareto Front" className={className}>
        <EmptyState message="Completed trials will appear here as the study progresses." />
      </PanelFrame>
    )
  }

  const title = chart.mode === 'multi' ? 'Pareto Front' : 'Best Trial Highlight'

  return (
    <PanelFrame title={title} className={className} interactive={Boolean(onSelectTrial)}>
      {chart.mode === 'single' ? (
        <p className="text-silver-500 mb-3 shrink-0 text-xs">
          Single-objective study — trial value by number with the best trial highlighted (no Pareto
          frontier).
        </p>
      ) : null}
      <div
        className="min-h-0 w-full flex-1 overflow-hidden"
        style={{ minHeight: CHART_MIN_HEIGHT_PX }}
      >
        <ResponsiveContainer width="100%" height="100%">
          {chart.mode === 'multi' ? (
            <ComposedChart margin={{ ...chartMargin, bottom: 8 }}>
              <ThemedCartesianGrid />
              <ThemedXAxis type="number" dataKey="x" name={chart.xLabel} />
              <ThemedYAxis type="number" dataKey="y" name={chart.yLabel} width={56} />
              <ThemedTooltip formatter={scatterTooltipFormatter(chart.xLabel, chart.yLabel)} />
              <Scatter
                data={chart.background}
                fill={chartTheme.semantic.reference}
                fillOpacity={0.25}
                shape="circle"
              />
              <Line
                data={chart.line}
                dataKey="y"
                stroke={chartTheme.semantic.equity}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Scatter
                data={chart.frontier}
                fill={chartTheme.semantic.equity}
                shape="circle"
                cursor={onSelectTrial ? 'pointer' : undefined}
                onClick={
                  onSelectTrial
                    ? (entry) => handleScatterClick(entry, selectedTrialNumber, onSelectTrial)
                    : undefined
                }
              >
                {chart.frontier.map((point) => (
                  <Cell
                    key={point.n}
                    fill={
                      point.n === selectedTrialNumber
                        ? chartTheme.series.primary
                        : frontierNumbers.has(point.n)
                          ? chartTheme.semantic.equity
                          : chartTheme.semantic.reference
                    }
                  />
                ))}
              </Scatter>
            </ComposedChart>
          ) : (
            <ComposedChart margin={{ ...chartMargin, bottom: 8 }}>
              <ThemedCartesianGrid />
              <ThemedXAxis type="number" dataKey="x" name={chart.xLabel} />
              <ThemedYAxis type="number" dataKey="y" name={chart.yLabel} width={72} />
              <ThemedTooltip formatter={scatterTooltipFormatter(chart.xLabel, chart.yLabel)} />
              <Scatter
                data={chart.points}
                shape="circle"
                cursor={onSelectTrial ? 'pointer' : undefined}
                onClick={
                  onSelectTrial
                    ? (entry) => handleScatterClick(entry, selectedTrialNumber, onSelectTrial)
                    : undefined
                }
              >
                {chart.points.map((point) => (
                  <Cell
                    key={point.n}
                    fill={
                      point.n === selectedTrialNumber
                        ? chartTheme.series.primary
                        : point.kind === 'best'
                          ? chartTheme.semantic.equity
                          : chartTheme.semantic.reference
                    }
                  />
                ))}
              </Scatter>
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>
    </PanelFrame>
  )
}

function handleScatterClick(
  entry: unknown,
  selectedTrialNumber: number | null | undefined,
  onSelectTrial: (trialNumber: number | null) => void,
) {
  const payload =
    entry && typeof entry === 'object' && 'payload' in entry
      ? (entry as { payload?: ScatterDatum }).payload
      : undefined
  const trialNumber = payload?.n
  if (trialNumber == null) return
  onSelectTrial(trialNumber === selectedTrialNumber ? null : trialNumber)
}

function PanelFrame({
  title,
  children,
  interactive = false,
  className,
}: {
  title: string
  children: ReactNode
  interactive?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'border-carbon-600/40 flex min-h-0 flex-1 flex-col rounded-lg border p-4',
        className,
      )}
    >
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <h4 className="text-silver-200 text-sm font-medium">{title}</h4>
        {interactive ? (
          <p className="text-silver-500 text-[10px] tracking-wide uppercase">
            Click a point to inspect
          </p>
        ) : null}
      </div>
      {children}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="text-silver-500 flex flex-1 items-center justify-center px-4 text-center text-sm"
      style={{ minHeight: CHART_MIN_HEIGHT_PX }}
    >
      {message}
    </div>
  )
}
