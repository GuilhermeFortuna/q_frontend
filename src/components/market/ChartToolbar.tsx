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
    <div className="border-carbon-700 bg-carbon-800/80 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2">
      <div className="bg-carbon-900 border-carbon-700/50 flex items-center gap-1 rounded border p-0.5">
        {CHART_TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => onTimeframeChange(tf)}
            className={`rounded px-2 py-1 font-mono text-[10px] font-bold transition-all ${
              selectedTimeframe === tf
                ? 'bg-brass-500 text-carbon-950 shadow'
                : 'text-silver-400 hover:text-silver-100 hover:bg-carbon-800'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4 text-xs">
        <div className="border-carbon-700 flex items-center gap-1.5 border-r pr-4">
          <span className="text-silver-400 text-[10px] font-semibold tracking-wider uppercase">
            Style
          </span>
          <select
            value={chartType}
            onChange={(e) => onChartTypeChange(e.target.value as 'candles' | 'line' | 'area')}
            className="border-carbon-700 bg-carbon-900 text-silver-200 focus:border-brass-500 rounded border px-2 py-0.5 text-xs outline-none"
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
