import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'

import { CHART_COLORS } from '@/components/backtests/chartUtils'
import type { OptimizationResults } from '@/types/optimization'

type OptimizationScatterProps = {
  results: OptimizationResults
  selectedTrialNumber?: number | null
}

export function OptimizationScatter({ results, selectedTrialNumber }: OptimizationScatterProps) {
  const completed = results.trials.filter((t) => t.values && t.values.length > 0)

  if (completed.length === 0) {
    return null
  }

  if (results.is_multi_objective) {
    // Pareto view: return (x) vs drawdown (y).
    const paretoNumbers = new Set(results.pareto_trials.map((t) => t.number))
    const dominated = completed
      .filter((t) => !paretoNumbers.has(t.number))
      .map((t) => ({ x: t.values![0], y: t.values![1], n: t.number }))
    const pareto = results.pareto_trials
      .filter((t) => t.values && t.values.length >= 2)
      .map((t) => ({ x: t.values![0], y: t.values![1], n: t.number }))

    return (
      <ChartFrame title="Pareto Front — Return vs Drawdown">
        <ScatterChart margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="x"
            name="Return"
            tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: CHART_COLORS.grid }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Drawdown"
            tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <ZAxis range={[50, 50]} />
          <Tooltip {...tooltipProps} />
          <Scatter name="Dominated" data={dominated} fill={CHART_COLORS.reference} />
          <Scatter name="Pareto" data={pareto} fill={CHART_COLORS.equity} />
        </ScatterChart>
      </ChartFrame>
    )
  }

  // Single-objective history: trial number (x) vs objective value (y).
  const bestNumber = results.best_trial?.number
  const highlightNumber = selectedTrialNumber ?? bestNumber
  const points = completed.map((t) => ({ x: t.number, y: t.values![0], n: t.number }))
  const highlighted = points.filter((p) => p.n === highlightNumber)
  const best = points.filter((p) => p.n === bestNumber && p.n !== highlightNumber)

  return (
    <ChartFrame title="Optimization History">
      <ScatterChart margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
        <XAxis
          type="number"
          dataKey="x"
          name="Trial"
          tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: CHART_COLORS.grid }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name="Objective"
          tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <ZAxis range={[50, 50]} />
        <Tooltip {...tooltipProps} />
        <Scatter name="Trial" data={points} fill={CHART_COLORS.reference} />
        {highlighted.length > 0 && (
          <Scatter name="Selected" data={highlighted} fill={CHART_COLORS.equity} />
        )}
        {best.length > 0 && <Scatter name="Best" data={best} fill={CHART_COLORS.equity} />}
      </ScatterChart>
    </ChartFrame>
  )
}

const tooltipProps = {
  cursor: { strokeDasharray: '3 3' },
  contentStyle: {
    backgroundColor: CHART_COLORS.tooltipBg,
    border: `1px solid ${CHART_COLORS.tooltipBorder}`,
    borderRadius: 6,
    fontSize: 12,
  },
  labelStyle: { color: CHART_COLORS.axis },
}

function ChartFrame({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <div className="border-carbon-600/40 flex flex-col rounded-lg border p-4">
      <h4 className="text-silver-200 mb-3 shrink-0 text-sm font-medium">{title}</h4>
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
