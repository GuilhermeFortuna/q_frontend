import { IndicatorsPopover } from '@/components/charts/IndicatorsPopover'
import { ChartSettingsPopover } from '@/components/charts/ChartSettingsPopover'
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
}: ChartToolbarProps) {
  return (
    <div className="surface-well border-brass-600/10 relative !z-20 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2">
      <SegmentedToggle
        aria-label="Chart timeframe"
        value={selectedTimeframe}
        onChange={onTimeframeChange}
        options={CHART_TIMEFRAMES.map((tf) => ({ value: tf, label: tf }))}
      />

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
          <span className="text-silver-300 text-[10px] font-bold tracking-wider uppercase">
            Grid
          </span>
        </label>
      </div>
    </div>
  )
}
