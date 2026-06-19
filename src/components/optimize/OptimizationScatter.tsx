import { useLayoutEffect, useRef, useState, type ReactElement } from 'react'
import { CartesianGrid, Cell, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'

import { CHART_COLORS } from '@/components/backtests/chartUtils'
import { cn } from '@/lib/utils'
import type { OptimizationResults } from '@/types/optimization'

type ScatterPoint = { x: number; y: number; n: number; fill: string }

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
  const completed = results.trials.filter((t) => t.values && t.values.length > 0)

  if (completed.length === 0) {
    return null
  }

  const bestNumber = results.best_trial?.number
  const highlightNumber = selectedTrialNumber ?? bestNumber

  if (results.is_multi_objective) {
    const paretoNumbers = new Set(results.pareto_trials.map((t) => t.number))
    const points = completed.map((trial) => {
      const onPareto = paretoNumbers.has(trial.number)
      const fill =
        trial.number === highlightNumber
          ? '#ffd700'
          : trial.number === bestNumber
            ? CHART_COLORS.equity
            : onPareto
              ? CHART_COLORS.equity
              : CHART_COLORS.reference
      return toPoint(trial.values![0], trial.values![1], trial.number, fill)
    })

    return (
      <ChartFrame
        title="Pareto Front — Return vs Drawdown"
        interactive={Boolean(onSelectTrial)}
        className={className}
        renderChart={(size) => (
          <ScatterChart
            width={size.width}
            height={size.height}
            margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
          >
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
              width={56}
            />
            <Tooltip {...tooltipProps} />
            <Scatter
              data={points}
              fill={CHART_COLORS.reference}
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

  const points = completed.map((trial) => {
    const fill =
      trial.number === highlightNumber
        ? '#ffd700'
        : trial.number === bestNumber
          ? CHART_COLORS.equity
          : CHART_COLORS.reference
    return toPoint(trial.number, trial.values![0], trial.number, fill)
  })

  return (
    <ChartFrame
      title="Optimization History"
      interactive={Boolean(onSelectTrial)}
      className={className}
      renderChart={(size) => (
        <ScatterChart
          width={size.width}
          height={size.height}
          margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
        >
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
            width={72}
          />
          <Tooltip {...tooltipProps} />
          <Scatter
            data={points}
            fill={CHART_COLORS.reference}
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

function toPoint(x: number, y: number, trialNumber: number, fill: string): ScatterPoint {
  return { x, y, n: trialNumber, fill }
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
  renderChart,
  interactive = false,
  className,
}: {
  title: string
  renderChart: (size: { width: number; height: number }) => ReactElement
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
      <MeasuredScatterChart className="min-h-[280px] w-full flex-1" renderChart={renderChart} />
    </div>
  )
}

function MeasuredScatterChart({
  renderChart,
  className,
}: {
  renderChart: (size: { width: number; height: number }) => ReactElement
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const element = containerRef.current
    if (!element) return

    const updateSize = () => {
      const rect = element.getBoundingClientRect()
      const measuredWidth = rect.width > 0 ? rect.width : element.clientWidth
      const measuredHeight = rect.height > 0 ? rect.height : element.clientHeight
      const parentWidth = element.parentElement?.clientWidth ?? 0
      const width = Math.floor(measuredWidth > 0 ? measuredWidth : parentWidth)
      const height = Math.floor(Math.max(measuredHeight, CHART_MIN_HEIGHT_PX))

      if (width > 0) {
        setSize({ width, height })
      }
    }

    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(element)
    window.addEventListener('resize', updateSize)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateSize)
    }
  }, [])

  return (
    <div ref={containerRef} className={className} style={{ minHeight: CHART_MIN_HEIGHT_PX }}>
      {size.width > 0 && size.height > 0 ? renderChart(size) : null}
    </div>
  )
}
