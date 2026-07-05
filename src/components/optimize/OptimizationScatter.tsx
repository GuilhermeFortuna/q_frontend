import { type ReactElement, useMemo } from 'react'
import { Cell, ResponsiveContainer, Scatter, ScatterChart } from 'recharts'

import {
  prepareOptimizationScatterData,
  type ScatterPoint,
} from '@/lib/optimize/prepareScatterData'
import { chartTheme } from '@/lib/charts/chartTheme'
import {
  ThemedCartesianGrid,
  ThemedTooltip,
  ThemedXAxis,
  ThemedYAxis,
  chartMargin,
  scatterTooltipFormatter,
} from '@/lib/charts/rechartsTheme'
import { cn } from '@/lib/utils'
import type { OptimizationResults } from '@/types/optimization'

const CHART_MIN_HEIGHT_PX = 280

type OptimizationScatterProps = {
  results: OptimizationResults
  selectedTrialNumber?: number | null
  onSelectTrial?: (trialNumber: number | null) => void
  className?: string
}

export function OptimizationScatter({
  results,
  selectedTrialNumber,
  onSelectTrial,
  className,
}: OptimizationScatterProps) {
  const bestNumber = results.best_trial?.number
  const highlightNumber = selectedTrialNumber ?? bestNumber

  const scatterData = useMemo(
    () => prepareOptimizationScatterData(results, highlightNumber),
    [results, highlightNumber],
  )

  if (scatterData.mode === 'empty') {
    return null
  }

  const { points, xLabel, yLabel } = scatterData
  const title =
    scatterData.mode === 'pareto' ? 'Pareto Front — Return vs Drawdown' : 'Optimization History'

  return (
    <ChartFrame
      title={title}
      interactive={Boolean(onSelectTrial)}
      className={className}
      renderChart={() => (
        <ScatterChart margin={{ ...chartMargin, bottom: 8 }}>
          <ThemedCartesianGrid />
          <ThemedXAxis type="number" dataKey="x" name={xLabel} />
          <ThemedYAxis
            type="number"
            dataKey="y"
            name={yLabel}
            width={scatterData.mode === 'pareto' ? 56 : 72}
          />
          <ThemedTooltip formatter={scatterTooltipFormatter(xLabel, yLabel)} />
          <Scatter
            data={points}
            fill={chartTheme.semantic.reference}
            shape="circle"
            cursor={onSelectTrial ? 'pointer' : undefined}
            onClick={
              onSelectTrial
                ? (entry) => {
                    const trialNumber = readTrialNumber(entry)
                    if (trialNumber == null) return
                    onSelectTrial(trialNumber === selectedTrialNumber ? null : trialNumber)
                  }
                : undefined
            }
          >
            {points.map((point) => (
              <Cell key={point.n} fill={point.fill} />
            ))}
          </Scatter>
        </ScatterChart>
      )}
    />
  )
}

function readTrialNumber(entry: unknown): number | undefined {
  if (!entry || typeof entry !== 'object') return undefined
  const payload = 'payload' in entry ? (entry as { payload?: ScatterPoint }).payload : undefined
  const direct = 'n' in entry ? (entry as ScatterPoint).n : undefined
  return payload?.n ?? direct
}

function ChartFrame({
  title,
  renderChart,
  interactive = false,
  className,
}: {
  title: string
  renderChart: () => ReactElement
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
      <div
        className="min-h-0 w-full flex-1 overflow-hidden"
        style={{ minHeight: CHART_MIN_HEIGHT_PX }}
      >
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
