import { IndicatorsPopover } from '@/components/charts/IndicatorsPopover'
import type { IndicatorConfig } from '@/components/charts/types/chart'
import { CHART_TIMEFRAMES } from '@/lib/market/timeframes'

export type ChartToolbarProps = {
  selectedTimeframe: string
  onTimeframeChange: (timeframe: string) => void
  chartType: 'candles' | 'line' | 'area'
  onChartTypeChange: (chartType: 'candles' | 'line' | 'area') => void
  indicators: IndicatorConfig[]
  onIndicatorsChange: (indicators: IndicatorConfig[]) => void
  showGrid: boolean
  onShowGridChange: (showGrid: boolean) => void
}

export function ChartToolbar({
  selectedTimeframe,
  onTimeframeChange,
  chartType,
  onChartTypeChange,
  indicators,
  onIndicatorsChange,
  showGrid,
  onShowGridChange,
}: ChartToolbarProps) {
  return (
    <div className="border-brass-600/10 bg-carbon-900/60 relative z-10 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2 backdrop-blur-md">
      <div className="bg-carbon-950/60 border-brass-600/15 flex items-center gap-1 rounded-lg border p-0.5">
        {CHART_TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => onTimeframeChange(tf)}
            className={`rounded-md border px-2.5 py-1 font-mono text-[10px] font-bold transition-all duration-150 active:scale-95 ${
              selectedTimeframe === tf
                ? 'bg-brass-600/20 text-brass-400 border-brass-500/30 shadow-[0_0_10px_rgba(196,165,116,0.08)]'
                : 'text-silver-400 hover:text-silver-100 hover:bg-carbon-800/40 border-transparent'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4 text-xs">
        <div className="border-brass-600/15 flex items-center gap-1.5 border-r pr-4">
          <span className="text-silver-400 text-[10px] font-bold tracking-wider uppercase">
            Style
          </span>
          <select
            value={chartType}
            onChange={(e) => onChartTypeChange(e.target.value as 'candles' | 'line' | 'area')}
            className="border-brass-600/15 bg-carbon-950/80 text-silver-200 focus:border-brass-500/60 focus:ring-brass-500/15 rounded-lg border px-2.5 py-1 text-xs shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] transition-all outline-none focus:ring-2"
          >
            <option value="candles">Candles</option>
            <option value="line">Line</option>
            <option value="area">Area</option>
          </select>
        </div>

        <IndicatorsPopover indicators={indicators} onChange={onIndicatorsChange} />

        <label className="flex cursor-pointer items-center gap-1.5 select-none">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => onShowGridChange(e.target.checked)}
            className="border-carbon-700 text-brass-500 accent-brass-500 cursor-pointer rounded focus:ring-0"
          />
          <span className="text-silver-300 text-[10px] font-bold tracking-wider uppercase">
            Grid
          </span>
        </label>
      </div>
    </div>
  )
}
