import type { RefObject } from 'react'
import { Activity, Plus, X } from 'lucide-react'
import { CandlestickChart } from '@/components/charts/CandlestickChart'
import { formatDisplayTimeSeconds } from '@/lib/formatDate'
import type { CandlestickChartHandle } from '@/components/charts/CandlestickChart'
import type {
  ChartViewport,
  DrawingObject,
  DrawingTool,
  IndicatorConfig,
  ChartSettings,
  ChartProfile,
} from '@/components/charts/types/chart'
import { DEFAULT_SETTINGS } from '@/components/charts/types/chart'
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
  tickTime: string | null
  chartRef: RefObject<CandlestickChartHandle | null>
  onHoverBar: (bar: OhlcvBar | null) => void
  onViewportChange: (viewport: ChartViewport) => void
  chartSettings?: ChartSettings
  profiles?: ChartProfile[]
  activeProfileId?: string
  onSelectProfile?: (id: string) => void
  onAddProfile?: () => void
  onDeleteProfile?: (id: string, e: React.MouseEvent | React.KeyboardEvent) => void
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
  tickTime,
  chartRef,
  onHoverBar,
  onViewportChange,
  chartSettings,
  profiles = [],
  activeProfileId = '',
  onSelectProfile,
  onAddProfile,
  onDeleteProfile,
}: ChartPanelProps) {
  const settings = {
    ...DEFAULT_SETTINGS,
    ...chartSettings,
  }

  const bgStyle =
    settings.backgroundType === 'gradient'
      ? { background: settings.backgroundColor }
      : { backgroundColor: settings.backgroundColor }

  return (
    <div className="relative min-h-0 flex-1 p-3">
      {(isBackfilling || isProbingRange) && bars.length > 0 && (
        <div className="text-brass-400 bg-carbon-950/80 border-brass-500/30 pointer-events-none absolute top-5 left-5 z-10 rounded border px-2 py-1 font-mono text-[10px] tracking-wide">
          Loading history…
        </div>
      )}
      {isInitialLoading ? (
        <div
          className="border-carbon-700 text-silver-400 flex h-full w-full flex-col items-center justify-center gap-3 rounded-lg border"
          style={bgStyle}
        >
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
          chartSettings={settings}
        />
      ) : (
        <div
          className="border-carbon-700 flex h-full w-full items-center justify-center rounded-lg border text-rose-300"
          style={bgStyle}
        >
          {error ? error.message : `Failed to load historical data for ${symbol}.`}
        </div>
      )}
      {/* Profiles tabs overlay */}
      {profiles.length > 0 && onSelectProfile && onAddProfile && onDeleteProfile && (
        <div className="border-brass-600/15 bg-carbon-950/60 absolute bottom-3 left-6 z-15 flex items-center gap-1.5 rounded-lg border p-0.5 shadow-lg backdrop-blur-md">
          {profiles.map((profile) => {
            const isActive = profile.id === activeProfileId
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => onSelectProfile(profile.id)}
                className={`group flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[9px] font-bold tracking-wide transition-all duration-150 active:scale-95 ${
                  isActive
                    ? 'border-brass-500/30 bg-brass-500/10 text-brass-400'
                    : 'text-silver-400 hover:bg-carbon-800/40 hover:text-silver-200 border-transparent'
                }`}
              >
                <span>{profile.name}</span>
                {profiles.length > 1 && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => onDeleteProfile(profile.id, e)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        onDeleteProfile(profile.id, e)
                      }
                    }}
                    className="text-silver-500 ml-0.5 rounded-full p-0.5 opacity-60 transition-all group-hover:opacity-100 hover:bg-rose-500/20 hover:text-rose-400"
                    title="Delete profile"
                  >
                    <X className="h-2 w-2" />
                  </span>
                )}
              </button>
            )
          })}
          <button
            type="button"
            onClick={onAddProfile}
            className="border-brass-500/10 hover:bg-carbon-800/40 text-brass-400 hover:text-brass-300 flex items-center gap-1 rounded border border-dashed px-2 py-0.5 font-mono text-[9px] font-bold transition-all active:scale-95"
            title="Create new profile"
          >
            <Plus className="h-2 w-2" />
          </button>
        </div>
      )}

      {tickTime ? (
        <div className="text-silver-500 pointer-events-none absolute right-5 bottom-3 font-mono text-[9px] tracking-wide uppercase">
          UPDATED {formatDisplayTimeSeconds(tickTime)}
        </div>
      ) : null}
    </div>
  )
}
