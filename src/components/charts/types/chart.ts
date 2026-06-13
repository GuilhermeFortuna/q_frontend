import type { OhlcvBar } from '@/types/api'

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
  | { type: 'sma'; enabled: boolean; period: number }
  | { type: 'ema'; enabled: boolean; period: number }
  | { type: 'bollinger'; enabled: boolean; period: number; stdDev: number }
  | { type: 'rsi'; enabled: boolean; period: number }
  | { type: 'macd'; enabled: boolean; fast: number; slow: number; signal: number }

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

export const BULL_COLOR = '#26a69a'
export const BEAR_COLOR = '#ef5350'
export const BRASS_COLOR = '#c9a227'
export const GRID_COLOR = 'rgba(111, 119, 133, 0.12)'

export const DEFAULT_VISIBLE_BARS = 120
export const MIN_VISIBLE_BARS = 20

export const DEFAULT_INDICATORS: IndicatorConfig[] = [
  { type: 'sma', enabled: true, period: 20 },
  { type: 'ema', enabled: false, period: 20 },
  { type: 'bollinger', enabled: false, period: 20, stdDev: 2 },
  { type: 'rsi', enabled: false, period: 14 },
  { type: 'macd', enabled: false, fast: 12, slow: 26, signal: 9 },
]

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
