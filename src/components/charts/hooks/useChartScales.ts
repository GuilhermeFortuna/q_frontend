import { useMemo } from 'react'
import { scaleBand, scaleLinear } from '@visx/scale'

import type { IndicatorConfig, PaneLayout, ProcessedBar } from '@/components/charts/types/chart'
import type { OhlcvBar } from '@/types/api'
import { BULL_COLOR, BEAR_COLOR } from '@/components/charts/types/chart'

const VOLUME_RATIO = 0.18
const OSCILLATOR_RATIO = 0.14

export function processBars(data: OhlcvBar[]): ProcessedBar[] {
  return data.map((bar, index) => {
    const isBullish = bar.close >= bar.open
    return {
      ...bar,
      index,
      timeMs: new Date(bar.timestamp).getTime(),
      isBullish,
      color: isBullish ? BULL_COLOR : BEAR_COLOR,
    }
  })
}

export function computePaneLayout(
  width: number,
  height: number,
  indicators: IndicatorConfig[],
  margins: { top: number; right: number; bottom: number; left: number },
): PaneLayout {
  const innerWidth = Math.max(width - margins.left - margins.right, 0)
  const innerHeight = Math.max(height - margins.top - margins.bottom, 0)

  const showRsi = indicators.some((i) => i.type === 'rsi' && i.enabled)
  const showMacd = indicators.some((i) => i.type === 'macd' && i.enabled)
  const oscillatorCount = (showRsi ? 1 : 0) + (showMacd ? 1 : 0)

  const volumeHeight = innerHeight * VOLUME_RATIO
  const oscillatorHeight = oscillatorCount > 0 ? innerHeight * OSCILLATOR_RATIO : 0
  const priceHeight = innerHeight - volumeHeight - oscillatorHeight * oscillatorCount

  let cursor = margins.top
  const priceTop = cursor
  cursor += priceHeight

  const volumeTop = cursor
  cursor += volumeHeight

  let rsiTop: number | undefined
  let rsiHeight: number | undefined
  let macdTop: number | undefined
  let macdHeight: number | undefined

  if (showRsi) {
    rsiTop = cursor
    rsiHeight = oscillatorHeight
    cursor += oscillatorHeight
  }
  if (showMacd) {
    macdTop = cursor
    macdHeight = oscillatorHeight
  }

  return {
    priceTop,
    priceHeight,
    volumeTop,
    volumeHeight,
    rsiTop,
    rsiHeight,
    macdTop,
    macdHeight,
    innerWidth,
    innerHeight,
  }
}

export function useChartScales(
  visibleBars: ProcessedBar[],
  layout: PaneLayout,
  margins: { left: number },
) {
  return useMemo(() => {
    const domain = visibleBars.map((b) => b.timestamp)
    const xScale = scaleBand<string>({
      domain,
      range: [0, layout.innerWidth],
      padding: 0.25,
    })

    const priceMin = Math.min(...visibleBars.map((b) => b.low))
    const priceMax = Math.max(...visibleBars.map((b) => b.high))
    const pricePad = (priceMax - priceMin) * 0.06 || 1

    const priceScale = scaleLinear<number>({
      domain: [priceMin - pricePad, priceMax + pricePad],
      range: [layout.priceTop + layout.priceHeight, layout.priceTop],
      nice: true,
    })

    const maxVolume = Math.max(...visibleBars.map((b) => b.volume), 1)
    const volumeScale = scaleLinear<number>({
      domain: [0, maxVolume],
      range: [layout.volumeTop + layout.volumeHeight, layout.volumeTop],
      nice: true,
    })

    const rsiScale = scaleLinear<number>({
      domain: [0, 100],
      range: [(layout.rsiTop ?? 0) + (layout.rsiHeight ?? 0), layout.rsiTop ?? 0],
    })

    const macdScale = scaleLinear<number>({
      domain: [-1, 1],
      range: [(layout.macdTop ?? 0) + (layout.macdHeight ?? 0), layout.macdTop ?? 0],
      nice: true,
    })

    return {
      xScale,
      priceScale,
      volumeScale,
      rsiScale,
      macdScale,
      marginLeft: margins.left,
    }
  }, [visibleBars, layout, margins.left])
}

export function barCenterX(
  xScale: ReturnType<typeof scaleBand<string>>,
  timestamp: string,
): number {
  return (xScale(timestamp) ?? 0) + xScale.bandwidth() / 2
}

export function timestampAtX(
  xScale: ReturnType<typeof scaleBand<string>>,
  x: number,
  bars: ProcessedBar[],
): ProcessedBar | null {
  if (bars.length === 0) return null
  let closest = bars[0]
  let minDist = Infinity
  for (const bar of bars) {
    const cx = barCenterX(xScale, bar.timestamp)
    const dist = Math.abs(cx - x)
    if (dist < minDist) {
      minDist = dist
      closest = bar
    }
  }
  return closest
}

export function priceAtY(priceScale: ReturnType<typeof scaleLinear<number>>, y: number): number {
  return priceScale.invert(y)
}

export function dataPointFromEvent(
  x: number,
  y: number,
  xScale: ReturnType<typeof scaleBand<string>>,
  priceScale: ReturnType<typeof scaleLinear<number>>,
  bars: ProcessedBar[],
): { timestamp: string; price: number } | null {
  const bar = timestampAtX(xScale, x, bars)
  if (!bar) return null
  return {
    timestamp: bar.timestamp,
    price: priceAtY(priceScale, y),
  }
}
