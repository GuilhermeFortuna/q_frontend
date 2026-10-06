import { IndicatorsPopover } from '@/components/charts/IndicatorsPopover'
import { ChartSettingsPopover } from '@/components/charts/ChartSettingsPopover'
import { Maximize2, Minimize2, Search } from 'lucide-react'
import type { IndicatorConfig, ChartSettings } from '@/components/charts/types/chart'
import { LabeledField } from '@/components/ui/LabeledField'
import { SegmentedToggle } from '@/components/ui/SegmentedToggle'
import { CHART_TIMEFRAMES } from '@/lib/market/timeframes'
import type { OhlcvBar } from '@/types/api'

export type ChartToolbarProps = {
  selectedTimeframe: string
  onTimeframeChange: (timeframe: string) => void
  chartType: 'candles' | 'line' | 'area'
  onChartTypeChange: (chartType: 'candles' | 'line' | 'area') => void
  indicators: IndicatorConfig[]
  onIndicatorsChange: (indicators: IndicatorConfig[]) => void
  bars: OhlcvBar[]
  showGrid: boolean
  onShowGridChange: (showGrid: boolean) => void
  chartSettings?: ChartSettings
  onChartSettingsChange?: (settings: ChartSettings) => void
  symbol?: string
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
  onOpenSymbolPicker?: () => void
}

const CHART_TYPE_OPTIONS = [
  { value: 'candles' as const, label: 'Candles' },
  { value: 'line' as const, label: 'Line' },
  { value: 'area' as const, label: 'Area' },
]

export function ChartToolbar({
  selectedTimeframe,
  onTimeframeChange,
  chartType,
  onChartTypeChange,
  indicators,
  onIndicatorsChange,
  bars,
  showGrid,
  onShowGridChange,
  chartSettings,
  onChartSettingsChange,
  symbol,
  isFullscreen = false,
  onToggleFullscreen,
  onOpenSymbolPicker,
}: ChartToolbarProps) {
  return (
    <div className="surface-well border-brass-600/10 relative !z-20 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2">
      <div className="flex flex-wrap items-center gap-2">
        {isFullscreen && symbol && onOpenSymbolPicker ? (
          <button
            type="button"
            onClick={onOpenSymbolPicker}
            aria-label={`Change symbol, current ${symbol}`}
            className="surface-control text-silver-100 hover:border-brass-500/40 flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-xs font-semibold"
          >
            <Search className="text-brass-400 h-3.5 w-3.5" />
            {symbol}
          </button>
        ) : null}
        <SegmentedToggle
          aria-label="Chart timeframe"
          value={selectedTimeframe}
          onChange={onTimeframeChange}
          options={CHART_TIMEFRAMES.map((tf) => ({ value: tf, label: tf }))}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs">
        <LabeledField label="Style" className="border-brass-600/15 border-r pr-4">
          <SegmentedToggle
            aria-label="Chart style"
            value={chartType}
            onChange={onChartTypeChange}
            options={CHART_TYPE_OPTIONS}
          />
        </LabeledField>

        <IndicatorsPopover indicators={indicators} onChange={onIndicatorsChange} bars={bars} />

        {chartSettings && onChartSettingsChange ? (
          <ChartSettingsPopover settings={chartSettings} onChange={onChartSettingsChange} />
        ) : null}

        <label className="flex cursor-pointer items-center gap-1.5 select-none">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => onShowGridChange(e.target.checked)}
            className="border-carbon-700 text-brass-500 accent-brass-500 cursor-pointer rounded focus:ring-0"
          />
          <span className="accent-wayfinding text-2xs font-[560] tracking-[0.08em] uppercase">
            Grid
          </span>
        </label>

        {onToggleFullscreen ? (
          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            className="surface-control text-silver-300 hover:text-brass-300 flex h-8 w-8 items-center justify-center rounded-md"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
    </div>
  )
}
