import type { RefObject } from 'react'
import { Activity } from 'lucide-react'

import { CandlestickChart } from '@/components/charts/CandlestickChart'
import type { CandlestickChartHandle } from '@/components/charts/CandlestickChart'
import type {
  ChartViewport,
  DrawingObject,
  DrawingTool,
  IndicatorConfig,
} from '@/components/charts/types/chart'
import type { OhlcvBar } from '@/types/api'

export type ChartPanelProps = {
  symbol: string
  timeframe: string
  chartType: 'candles' | 'line' | 'area'
  indicators: IndicatorConfig[]
  showGrid: boolean
  activeDrawingTool: DrawingTool
  drawings: DrawingObject[]
  onDrawingsChange: (drawings: DrawingObject[]) => void
  bars: OhlcvBar[]
  isInitialLoading: boolean
  isBackfilling: boolean
  isProbingRange: boolean
  error: Error | null
  chartRef: RefObject<CandlestickChartHandle | null>
  onHoverBar: (bar: OhlcvBar | null) => void
  onViewportChange: (viewport: ChartViewport) => void
}

export function ChartPanel({
  symbol,
  timeframe,
  chartType,
  indicators,
  showGrid,
  activeDrawingTool,
  drawings,
  onDrawingsChange,
  bars,
  isInitialLoading,
  isBackfilling,
  isProbingRange,
  error,
  chartRef,
  onHoverBar,
  onViewportChange,
}: ChartPanelProps) {
  return (
    <div className="relative min-h-0 flex-1 p-3">
      {(isBackfilling || isProbingRange) && bars.length > 0 && (
        <div className="text-brass-400 bg-carbon-950/80 border-brass-500/30 pointer-events-none absolute top-5 left-5 z-10 rounded border px-2 py-1 font-mono text-[10px] tracking-wide">
          Loading history…
        </div>
      )}
      {isInitialLoading ? (
        <div className="border-carbon-700 bg-carbon-900/40 text-silver-400 flex h-full w-full flex-col items-center justify-center gap-3 rounded-lg border">
          <Activity className="text-brass-500 h-8 w-8 animate-pulse" />
          <span className="font-mono text-sm">Loading market candles…</span>
        </div>
      ) : bars.length > 0 ? (
        <CandlestickChart
          ref={chartRef}
          data={bars}
          symbol={symbol}
          timeframe={timeframe}
          resetKey={`${symbol}:${timeframe}`}
          showGrid={showGrid}
          chartType={chartType}
          indicators={indicators}
          activeDrawingTool={activeDrawingTool}
          drawings={drawings}
          onDrawingsChange={onDrawingsChange}
          onHoverBar={onHoverBar}
          onViewportChange={onViewportChange}
        />
      ) : (
        <div className="border-carbon-700 bg-carbon-900/40 flex h-full w-full items-center justify-center rounded-lg border text-rose-300">
          {error ? error.message : `Failed to load historical data for ${symbol}.`}
        </div>
      )}
    </div>
  )
}
