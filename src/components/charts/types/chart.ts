import type { OhlcvBar } from '@/types/api'
import { chartTheme } from '@/lib/charts/chartTheme'

export type ChartType = 'candles' | 'line' | 'area'

export type {
  IndicatorConfig,
  IndicatorStyle,
  IndicatorLineStyle,
} from '@/lib/market/indicatorConfig'
import type { IndicatorConfig } from '@/lib/market/indicatorConfig'

/**
 * A backend-computed indicator series aligned bar-for-bar to the chart's `bars`.
 * Values are rendered verbatim; `null` entries are warm-up gaps and break the drawn line.
 */
export type PrecomputedIndicatorSeries = {
  key: string
  label: string
  pane: 'price' | 'oscillator'
  color?: string | null
  values: (number | null)[]
}

export type ChartMarkerKind = 'buy' | 'sell' | 'close' | 'fill'

/** A decision/fill event pinned to a bar timestamp on the live execution chart. */
export type ChartMarker = {
  id: string
  /** Bar (open) timestamp this marker aligns to. */
  timestamp: string
  kind: ChartMarkerKind
  label: string
  /** Multi-line hover detail (action, reason, quantity, price). */
  detail: string
  /** Optional price used to vertically place fill markers. */
  price?: number | null
}

export type ChartSettings = {
  backgroundType: 'gradient' | 'solid'
  backgroundColor: string
  showWatermark: boolean
  candleOpacity: number
  volumeOpacity: number
  crosshairColor: string
}

export type ChartViewport = {
  startIndex: number
  endIndex: number
}

export type ChartSlot = {
  key: string
  bar: ProcessedBar | null
}

export function isPaddingSlotKey(key: string): boolean {
  return key.startsWith('__pad:')
}

export function buildViewportSlots(
  processed: ProcessedBar[],
  viewport: ChartViewport,
): ChartSlot[] {
  const slots: ChartSlot[] = []
  for (let i = viewport.startIndex; i <= viewport.endIndex; i += 1) {
    const bar = processed[i] ?? null
    slots.push({ key: bar?.timestamp ?? `__pad:${i}`, bar })
  }
  return slots
}

export function barsFromSlots(slots: ChartSlot[]): ProcessedBar[] {
  return slots.flatMap((slot) => (slot.bar ? [slot.bar] : []))
}

export type ChartMargins = {
  top: number
  right: number
  bottom: number
  left: number
}

export const CHART_MARGINS: ChartMargins = {
  top: 12,
  right: 64,
  bottom: 28,
  left: 8,
}

export const BULL_COLOR = chartTheme.candle.bull
export const BEAR_COLOR = chartTheme.candle.bear
export const BRASS_COLOR = chartTheme.candle.brass
export const GRID_COLOR = chartTheme.grid.stroke

export const DEFAULT_VISIBLE_BARS = 120
export const MIN_VISIBLE_BARS = 20
export const MAX_PRICE_SCALE_FACTOR = 20
export const MIN_PRICE_SCALE_FACTOR = 0.05
export const PRICE_AXIS_STRETCH_SENSITIVITY = 0.008
export const TIME_AXIS_STRETCH_SENSITIVITY = 1

export const DEFAULT_INDICATORS: IndicatorConfig[] = [
  {
    id: 'sma',
    enabled: true,
    parameters: { period: 20 },
    style: { color: '#c9a227', strokeWidth: 1.2, lineStyle: 'dashed' },
  },
  {
    id: 'ema',
    enabled: false,
    parameters: { period: 20 },
    style: { color: '#6eb5ff', strokeWidth: 1.2, lineStyle: 'solid' },
  },
  {
    id: 'bollinger',
    enabled: false,
    parameters: { period: 20, num_std: 2 },
    style: { color: '#c9a227', strokeWidth: 1.0, showCloud: true },
  },
  {
    id: 'rsi',
    enabled: false,
    parameters: { period: 14 },
    style: { color: '#a78bfa', strokeWidth: 1.2, showCloud: true },
  },
  {
    id: 'macd',
    enabled: false,
    parameters: { fast_period: 12, slow_period: 26, signal_period: 9 },
    style: { outputColors: { line: '#6eb5ff', signal: '#c9a227' } },
  },
  {
    id: 'volume_ma',
    enabled: false,
    parameters: { period: 20 },
    style: { color: '#a78bfa', strokeWidth: 1.2, lineStyle: 'solid' },
  },
  {
    id: 'vwap',
    enabled: false,
    parameters: {},
    style: { color: '#38bdf8', strokeWidth: 1.2, lineStyle: 'solid' },
  },
  {
    id: 'wma',
    enabled: false,
    parameters: { period: 20 },
    style: { color: '#f97316', strokeWidth: 1.2, lineStyle: 'solid' },
  },
  {
    id: 'hma',
    enabled: false,
    parameters: { period: 20 },
    style: { color: '#26a69a', strokeWidth: 1.2, lineStyle: 'solid' },
  },
  {
    id: 'smma',
    enabled: false,
    parameters: { period: 20 },
    style: { color: '#ef5350', strokeWidth: 1.2, lineStyle: 'solid' },
  },
  {
    id: 'donchian',
    enabled: false,
    parameters: { period: 20 },
    style: { color: '#6eb5ff', strokeWidth: 1.0, showCloud: true },
  },
]

export const DEFAULT_SETTINGS: ChartSettings = {
  backgroundType: 'gradient',
  backgroundColor: 'radial-gradient(circle at 50% 30%, #16273f 0%, #07101c 100%)',
  showWatermark: true,
  candleOpacity: 0.85,
  volumeOpacity: 0.4,
  crosshairColor: chartTheme.crosshair.stroke,
}

export type ProcessedBar = OhlcvBar & {
  index: number
  timeMs: number
  isBullish: boolean
  color: string
}
import type { BandScale, LinearScale } from '@/components/charts/types/scales'

export type ChartScales = {
  xScale: BandScale
  priceScale: LinearScale
  volumeScale: LinearScale
  oscillatorScales: Array<{ key: string; scale: LinearScale }>
}

export type OscillatorPaneSlot = {
  key: string
  top: number
  height: number
}

/** User layout of the price stack, persisted per chart profile. */
export type PaneLayoutPrefs = {
  /** Top-to-bottom pane keys: `price`, `volume` and oscillator instance keys. */
  order?: string[]
  /** Height as a fraction of the inner chart height, by pane key. */
  heights?: Record<string, number>
}

export type PaneLayout = {
  priceTop: number
  priceHeight: number
  volumeTop: number
  volumeHeight: number
  /** Oscillator panes in stack order. */
  oscillators: OscillatorPaneSlot[]
  /** Every pane in stack order, including price and volume. */
  stack: OscillatorPaneSlot[]
  innerWidth: number
  innerHeight: number
}

export type {
  VolumeProfileOverlaySettings,
  VolumeProfileSegmentMode,
} from '@/lib/market/volumeProfileConfig'
export {
  DEFAULT_VOLUME_PROFILE_SETTINGS,
  VOLUME_PROFILE_INDICATOR_ID,
  defaultVolumeProfileIndicatorConfig,
} from '@/lib/market/volumeProfileConfig'

export type ChartProfile = {
  id: string
  name: string
  chartType: 'candles' | 'line' | 'area'
  showGrid: boolean
  indicators: IndicatorConfig[]
  chartSettings: ChartSettings
  paneLayout?: PaneLayoutPrefs
}
