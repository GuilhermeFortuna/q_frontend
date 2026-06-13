import { useCallback, useEffect, useMemo, useState } from 'react'
import { scaleBand, scaleLinear } from '@visx/scale'

import type {
  ChartSlot,
  IndicatorConfig,
  PaneLayout,
  ProcessedBar,
} from '@/components/charts/types/chart'
import type { OhlcvBar } from '@/types/api'
import {
  BULL_COLOR,
  BEAR_COLOR,
  MAX_PRICE_SCALE_FACTOR,
  MIN_PRICE_SCALE_FACTOR,
  PRICE_AXIS_STRETCH_SENSITIVITY,
} from '@/components/charts/types/chart'

export function computePriceDomain(bars: ProcessedBar[], paddingRatio = 0.06) {
  if (bars.length === 0) {
    return { min: 0, max: 1, span: 1 }
  }
  const priceMin = Math.min(...bars.map((b) => b.low))
  const priceMax = Math.max(...bars.map((b) => b.high))
  const pricePad = (priceMax - priceMin) * paddingRatio || 1
  const min = priceMin - pricePad
  const max = priceMax + pricePad
  return { min, max, span: max - min }
}

export function applyPriceAxisTransform(
  domain: { min: number; max: number; span: number },
  panOffset: number,
  scaleFactor: number,
): [number, number] {
  const center = (domain.min + domain.max) / 2 + panOffset
  const halfSpan = (domain.span / 2) * scaleFactor
  return [center - halfSpan, center + halfSpan]
}

export function usePriceAxis(resetKey: string) {
  const [offset, setOffset] = useState(0)
  const [scaleFactor, setScaleFactor] = useState(1)

  useEffect(() => {
    setOffset(0)
    setScaleFactor(1)
  }, [resetKey])

  const resetPriceAxis = useCallback(() => {
    setOffset(0)
    setScaleFactor(1)
  }, [])

  const panPriceByPixels = useCallback(
    (deltaY: number, pricePaneHeight: number, domainSpan: number) => {
      if (pricePaneHeight <= 0 || domainSpan <= 0) return
      const pricePerPixel = domainSpan / pricePaneHeight
      setOffset((prev) => prev + deltaY * pricePerPixel)
    },
    [],
  )

  const stretchPriceByPixels = useCallback((deltaY: number) => {
    if (deltaY === 0) return
    const factor = Math.exp(deltaY * PRICE_AXIS_STRETCH_SENSITIVITY)
    setScaleFactor((prev) =>
      Math.max(MIN_PRICE_SCALE_FACTOR, Math.min(MAX_PRICE_SCALE_FACTOR, prev * factor)),
    )
  }, [])

  return {
    pricePanOffset: offset,
    priceScaleFactor: scaleFactor,
    resetPriceAxis,
    panPriceByPixels,
    stretchPriceByPixels,
  }
}

/** @deprecated Use usePriceAxis instead. */
export function usePricePan(resetKey: string) {
  const axis = usePriceAxis(resetKey)
  return {
    pricePanOffset: axis.pricePanOffset,
    resetPricePan: axis.resetPriceAxis,
    panPriceByPixels: axis.panPriceByPixels,
  }
}

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
  slots: ChartSlot[],
  layout: PaneLayout,
  margins: { left: number },
  pricePanOffset = 0,
  priceScaleFactor = 1,
) {
  return useMemo(() => {
    const barsInView = slots.flatMap((slot) => (slot.bar ? [slot.bar] : []))
    const domain = slots.map((slot) => slot.key)
    const xScale = scaleBand<string>({
      domain,
      range: [0, layout.innerWidth],
      padding: 0.25,
    })

    const priceDomain = computePriceDomain(barsInView)

    const priceScale = scaleLinear<number>({
      domain: applyPriceAxisTransform(priceDomain, pricePanOffset, priceScaleFactor),
      range: [layout.priceTop + layout.priceHeight, layout.priceTop],
      nice: true,
    })

    const maxVolume = Math.max(...barsInView.map((b) => b.volume), 1)
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
  }, [slots, layout, margins.left, pricePanOffset, priceScaleFactor])
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
