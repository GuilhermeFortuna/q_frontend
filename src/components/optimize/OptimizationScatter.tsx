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
import { cn } from '@/lib/utils'
import type { OptimizationResults } from '@/types/optimization'

type ScatterPoint = { x: number; y: number; n: number }

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
  const completed = results.trials.filter((t) => t.values && t.values.length > 0)

  if (completed.length === 0) {
    return null
  }

  const bestNumber = results.best_trial?.number
  const highlightNumber = selectedTrialNumber ?? bestNumber

  if (results.is_multi_objective) {
    // Pareto view: return (x) vs drawdown (y).
    const paretoNumbers = new Set(results.pareto_trials.map((t) => t.number))
    const dominated = completed
      .filter((t) => !paretoNumbers.has(t.number))
      .map((t) => toPoint(t.values![0], t.values![1], t.number))
    const pareto = results.pareto_trials
      .filter((t) => t.values && t.values.length >= 2)
      .map((t) => toPoint(t.values![0], t.values![1], t.number))

    const dominatedSplit = partitionPoints(dominated, highlightNumber, bestNumber)
    const paretoSplit = partitionPoints(pareto, highlightNumber, bestNumber)

    return (
      <ChartFrame
        title="Pareto Front — Return vs Drawdown"
        interactive={Boolean(onSelectTrial)}
        className={className}
      >
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
          <SelectableScatter
            name="Dominated"
            data={dominatedSplit.rest}
            fill={CHART_COLORS.reference}
            onSelectTrial={onSelectTrial}
            selectedTrialNumber={selectedTrialNumber}
          />
          <SelectableScatter
            name="Pareto"
            data={paretoSplit.rest}
            fill={CHART_COLORS.equity}
            onSelectTrial={onSelectTrial}
            selectedTrialNumber={selectedTrialNumber}
          />
          <SelectableScatter
            name="Best"
            data={[...dominatedSplit.best, ...paretoSplit.best]}
            fill={CHART_COLORS.equity}
            onSelectTrial={onSelectTrial}
            selectedTrialNumber={selectedTrialNumber}
          />
          <SelectableScatter
            name="Selected"
            data={[...dominatedSplit.selected, ...paretoSplit.selected]}
            fill="#ffd700"
            onSelectTrial={onSelectTrial}
            selectedTrialNumber={selectedTrialNumber}
          />
        </ScatterChart>
      </ChartFrame>
    )
  }

  // Single-objective history: trial number (x) vs objective value (y).
  const points = completed.map((t) => toPoint(t.number, t.values![0], t.number))
  const { rest, best, selected } = partitionPoints(points, highlightNumber, bestNumber)

  return (
    <ChartFrame
      title="Optimization History"
      interactive={Boolean(onSelectTrial)}
      className={className}
    >
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
        <SelectableScatter
          name="Trial"
          data={rest}
          fill={CHART_COLORS.reference}
          onSelectTrial={onSelectTrial}
          selectedTrialNumber={selectedTrialNumber}
        />
        {best.length > 0 && (
          <SelectableScatter
            name="Best"
            data={best}
            fill={CHART_COLORS.equity}
            onSelectTrial={onSelectTrial}
            selectedTrialNumber={selectedTrialNumber}
          />
        )}
        {selected.length > 0 && (
          <SelectableScatter
            name="Selected"
            data={selected}
            fill="#ffd700"
            onSelectTrial={onSelectTrial}
            selectedTrialNumber={selectedTrialNumber}
          />
        )}
      </ScatterChart>
    </ChartFrame>
  )
}

function toPoint(x: number, y: number, trialNumber: number): ScatterPoint {
  return { x, y, n: trialNumber }
}

function partitionPoints(
  points: ScatterPoint[],
  highlightNumber: number | undefined,
  bestNumber: number | undefined,
) {
  const selected: ScatterPoint[] = []
  const best: ScatterPoint[] = []
  const rest: ScatterPoint[] = []

  for (const point of points) {
    if (point.n === highlightNumber) {
      selected.push(point)
    } else if (point.n === bestNumber) {
      best.push(point)
    } else {
      rest.push(point)
    }
  }

  return { selected, best, rest }
}

type SelectableScatterProps = {
  name: string
  data: ScatterPoint[]
  fill: string
  onSelectTrial?: (trialNumber: number | null) => void
  selectedTrialNumber?: number | null
}

function SelectableScatter({
  name,
  data,
  fill,
  onSelectTrial,
  selectedTrialNumber,
}: SelectableScatterProps) {
  if (data.length === 0) return null

  return (
    <Scatter
      name={name}
      data={data}
      fill={fill}
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
    />
  )
}

function readTrialNumber(entry: unknown): number | undefined {
  if (!entry || typeof entry !== 'object') return undefined
  const payload = 'payload' in entry ? (entry as { payload?: ScatterPoint }).payload : undefined
  const direct = 'n' in entry ? (entry as ScatterPoint).n : undefined
  return payload?.n ?? direct
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
  formatter: (value: number, _name: string, item: { payload?: ScatterPoint }) => {
    const trialNumber = item.payload?.n
    return [value.toFixed(4), trialNumber != null ? `Trial #${trialNumber}` : _name]
  },
}

function ChartFrame({
  title,
  children,
  interactive = false,
  className,
}: {
  title: string
  children: React.ReactElement
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
      <div className="min-h-0 w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
