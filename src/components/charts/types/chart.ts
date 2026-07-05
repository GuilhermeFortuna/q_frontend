import type { OhlcvBar } from '@/types/api'
import { chartTheme } from '@/lib/charts/chartTheme'

export type ChartType = 'candles' | 'line' | 'area'

export type DrawingTool = 'cursor' | 'trendline' | 'horizontal' | 'fibo' | 'text' | 'eraser'

export type DataPoint = {
  timestamp: string
  price: number
}

export type DrawingObject =
  | { id: string; type: 'trendline'; p1: DataPoint; p2: DataPoint }
  | { id: string; type: 'horizontal'; price: number }
  | { id: string; type: 'fibo'; p1: DataPoint; p2: DataPoint }
  | { id: string; type: 'text'; point: DataPoint; label: string }

export type IndicatorConfig =
  | {
      type: 'sma'
      enabled: boolean
      period: number
      color?: string
      strokeWidth?: number
      lineStyle?: 'solid' | 'dashed' | 'dotted'
    }
  | {
      type: 'ema'
      enabled: boolean
      period: number
      color?: string
      strokeWidth?: number
      lineStyle?: 'solid' | 'dashed' | 'dotted'
    }
  | {
      type: 'bollinger'
      enabled: boolean
      period: number
      stdDev: number
      color?: string
      strokeWidth?: number
      showCloud?: boolean
    }
  | {
      type: 'rsi'
      enabled: boolean
      period: number
      color?: string
      strokeWidth?: number
      showCloud?: boolean
    }
  | {
      type: 'macd'
      enabled: boolean
      fast: number
      slow: number
      signal: number
      macdColor?: string
      signalColor?: string
    }
  | {
      type: 'volumeMa'
      enabled: boolean
      period: number
      color?: string
      strokeWidth?: number
      lineStyle?: 'solid' | 'dashed' | 'dotted'
    }
  | {
      type: 'wma'
      enabled: boolean
      period: number
      color?: string
      strokeWidth?: number
      lineStyle?: 'solid' | 'dashed' | 'dotted'
    }
  | {
      type: 'hma'
      enabled: boolean
      period: number
      color?: string
      strokeWidth?: number
      lineStyle?: 'solid' | 'dashed' | 'dotted'
    }
  | {
      type: 'smma'
      enabled: boolean
      period: number
      color?: string
      strokeWidth?: number
      lineStyle?: 'solid' | 'dashed' | 'dotted'
    }
  | {
      type: 'donchian'
      enabled: boolean
      period: number
      color?: string
      strokeWidth?: number
      showCloud?: boolean
    }

/**
 * A backend-computed indicator series aligned bar-for-bar to the chart's `bars`.
 * Unlike {@link IndicatorConfig} (client-computed for the Market workspace) these
 * values are rendered verbatim — the live execution chart never recomputes strategy
 * indicators. `null` entries are warm-up gaps and break the drawn line.
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
    type: 'sma',
    enabled: true,
    period: 20,
    color: '#c9a227',
    strokeWidth: 1.2,
    lineStyle: 'dashed',
  },
  {
    type: 'ema',
    enabled: false,
    period: 20,
    color: '#6eb5ff',
    strokeWidth: 1.2,
    lineStyle: 'solid',
  },
  {
    type: 'bollinger',
    enabled: false,
    period: 20,
    stdDev: 2,
    color: '#c9a227',
    strokeWidth: 1.0,
    showCloud: true,
  },
  { type: 'rsi', enabled: false, period: 14, color: '#a78bfa', strokeWidth: 1.2, showCloud: true },
  {
    type: 'macd',
    enabled: false,
    fast: 12,
    slow: 26,
    signal: 9,
    macdColor: '#6eb5ff',
    signalColor: '#c9a227',
  },
  {
    type: 'volumeMa',
    enabled: false,
    period: 20,
    color: '#a78bfa',
    strokeWidth: 1.2,
    lineStyle: 'solid',
  },
  {
    type: 'wma',
    enabled: false,
    period: 20,
    color: '#f97316',
    strokeWidth: 1.2,
    lineStyle: 'solid',
  },
  {
    type: 'hma',
    enabled: false,
    period: 20,
    color: '#26a69a',
    strokeWidth: 1.2,
    lineStyle: 'solid',
  },
  {
    type: 'smma',
    enabled: false,
    period: 20,
    color: '#ef5350',
    strokeWidth: 1.2,
    lineStyle: 'solid',
  },
  {
    type: 'donchian',
    enabled: false,
    period: 20,
    color: '#6eb5ff',
    strokeWidth: 1.0,
    showCloud: true,
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
  rsiScale?: LinearScale
  macdScale?: LinearScale
}

export type PaneLayout = {
  priceTop: number
  priceHeight: number
  volumeTop: number
  volumeHeight: number
  rsiTop?: number
  rsiHeight?: number
  macdTop?: number
  macdHeight?: number
  innerWidth: number
  innerHeight: number
}

export type ChartProfile = {
  id: string
  name: string
  chartType: 'candles' | 'line' | 'area'
  showGrid: boolean
  indicators: IndicatorConfig[]
  chartSettings: ChartSettings
}
