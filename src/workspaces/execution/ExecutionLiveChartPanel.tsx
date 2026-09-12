import { useEffect, useMemo, useState } from 'react'
import { isAxiosError } from 'axios'

import {
  EXECUTION_CHART_BARS,
  useDecisions,
  useDeploymentChart,
  useFills,
} from '@/api/queries/execution'
import { useMarketSnapshot } from '@/api/queries/market-data'
import { LiveStrategyChart } from '@/components/charts/LiveStrategyChart'
import type { PrecomputedIndicatorSeries } from '@/components/charts/types/chart'
import { Panel, PanelHeader } from '@/components/ui/Panel'
import { buildChartMarkers } from '@/workspaces/execution/liveChartMarkers'
import type { DeploymentChart } from '@/types/execution'
import type { OhlcvBar } from '@/types/api'
import { cn } from '@/lib/utils'

type ExecutionLiveChartPanelProps = {
  deploymentId: string | null
  symbol: string | null
  pollingEnabled: boolean
  className?: string
  chartHeight?: number | string
}

function toOhlcvBars(chart: DeploymentChart): OhlcvBar[] {
  return chart.bars.map((bar) => ({
    timestamp: bar.timestamp,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
  }))
}

function toIndicatorSeries(chart: DeploymentChart): PrecomputedIndicatorSeries[] {
  return chart.indicators.map((indicator) => ({
    key: indicator.key,
    label: indicator.label,
    pane: indicator.pane,
    color: indicator.color,
    values: indicator.values,
  }))
}

/**
 * Build a live forming bar from the latest market quote. Its open is the last
 * completed close and it sits one bar ahead (open = last bar's close time), so the
 * candlestick reads as an in-progress bar. Indicator series never extend into it.
 */
function buildFormingBar(
  chart: DeploymentChart,
  completed: OhlcvBar[],
  lastPrice: number | undefined,
): OhlcvBar | null {
  if (lastPrice == null || !Number.isFinite(lastPrice)) return null
  const lastCompleted = completed[completed.length - 1]
  const openTime = chart.last_bar_close_time
  if (!lastCompleted || !openTime) return null
  if (Date.parse(openTime) <= Date.parse(lastCompleted.timestamp)) return null
  const open = lastCompleted.close
  return {
    timestamp: openTime,
    open,
    high: Math.max(open, lastPrice),
    low: Math.min(open, lastPrice),
    close: lastPrice,
    volume: 0,
  }
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`
}

function useCountdown(target: string | null | undefined, active: boolean): string | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active || !target) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(id)
  }, [active, target])
  if (!target) return null
  const remaining = Date.parse(target) - now
  if (Number.isNaN(remaining)) return null
  return formatCountdown(remaining)
}

export function ExecutionLiveChartPanel({
  deploymentId,
  symbol,
  pollingEnabled,
  className,
  chartHeight,
}: ExecutionLiveChartPanelProps) {
  const enabled = pollingEnabled && !!deploymentId
  const chartQuery = useDeploymentChart(deploymentId, EXECUTION_CHART_BARS, { enabled })
  const decisionsQuery = useDecisions(deploymentId, 0, { enabled })
  const fillsQuery = useFills(deploymentId, 0, { enabled })
  const snapshotQuery = useMarketSnapshot(symbol ?? '', enabled && !!symbol)

  const chart = chartQuery.data
  const error = chartQuery.error
  const is404 = isAxiosError(error) && error.response?.status === 404
  const isStale = !!error && !is404 && !!chart

  const completedBars = useMemo(() => (chart ? toOhlcvBars(chart) : []), [chart])
  const indicators = useMemo(() => (chart ? toIndicatorSeries(chart) : []), [chart])

  const formingBar = useMemo(
    () => (chart ? buildFormingBar(chart, completedBars, snapshotQuery.data?.last) : null),
    [chart, completedBars, snapshotQuery.data?.last],
  )

  const markers = useMemo(() => {
    if (!chart) return []
    return buildChartMarkers({
      decisions: decisionsQuery.data?.items ?? [],
      fills: fillsQuery.data?.items ?? [],
      bars: chart.bars,
      timeframe: chart.timeframe,
    })
  }, [chart, decisionsQuery.data?.items, fillsQuery.data?.items])

  const countdown = useCountdown(chart?.next_bar_close_time, enabled)

  const header = (
    <PanelHeader
      title="Live chart"
      right={
        chart ? (
          <span className="text-silver-500 font-mono text-xs" data-testid="live-chart-symbol">
            {chart.symbol} · {chart.timeframe}
          </span>
        ) : null
      }
    />
  )

  if (!deploymentId) {
    return (
      <Panel className="p-4" data-testid="execution-live-chart-panel">
        {header}
        <p className="text-silver-500 text-sm">Select a deployment to see its live chart.</p>
      </Panel>
    )
  }

  if (is404) {
    return (
      <Panel className="p-4" data-testid="execution-live-chart-panel">
        {header}
        <div
          className="border-silver-500/20 bg-carbon-900/60 text-silver-400 rounded-lg border border-dashed p-6 text-center text-sm"
          data-testid="live-chart-unavailable"
        >
          <p className="text-silver-300 font-semibold">Live chart unavailable</p>
          <p className="mt-1">
            This backend does not expose the deployment chart endpoint yet. Deployment control and
            history remain fully available.
          </p>
        </div>
      </Panel>
    )
  }

  if (!chart) {
    return (
      <Panel className="p-4" data-testid="execution-live-chart-panel">
        {header}
        {chartQuery.isLoading ? (
          <p className="text-silver-400 text-sm" data-testid="live-chart-loading">
            Loading chart…
          </p>
        ) : (
          <p className="text-sm text-amber-300" data-testid="live-chart-market-unavailable">
            Market data is unavailable right now — the chart will appear once bars can be loaded.
          </p>
        )}
      </Panel>
    )
  }

  return (
    <Panel className={cn('p-4', className)} data-testid="execution-live-chart-panel">
      {header}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-silver-500 text-xs" data-testid="live-chart-bar-close-note">
          Decisions occur at bar close — indicators reflect exactly what the worker evaluates.
        </p>
        {countdown ? (
          <span
            className="border-brass-500/30 bg-carbon-900/80 text-brass-300 rounded border px-2 py-0.5 font-mono text-xs"
            data-testid="live-chart-countdown"
            title="Time until the next bar closes and the strategy re-evaluates."
          >
            Next bar in {countdown}
          </span>
        ) : null}
      </div>
      {isStale ? (
        <p className="mb-2 text-xs text-amber-300" data-testid="live-chart-stale-note">
          Market data is stale — showing the last chart the worker could load.
        </p>
      ) : null}
      <div className="flex min-h-0 w-full flex-1 flex-col">
        <LiveStrategyChart
          bars={completedBars}
          formingBar={formingBar}
          indicators={indicators}
          markers={markers}
          symbol={chart.symbol}
          timeframe={chart.timeframe}
          height={chartHeight}
        />
      </div>
    </Panel>
  )
}
