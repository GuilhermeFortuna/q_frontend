import { useCallback, useEffect, useMemo, useState } from 'react'
import { scaleBand, scaleLinear } from '@visx/scale'

import type {
  ChartSlot,
  OscillatorPaneSlot,
  PaneLayout,
  ProcessedBar,
} from '@/components/charts/types/chart'
import type { OhlcvBar } from '@/types/api'
import type { OscillatorRenderGroup } from '@/lib/market/buildIndicatorRenderModel'
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
  oscillatorPaneKeys: string[],
  margins: { top: number; right: number; bottom: number; left: number },
): PaneLayout {
  const innerWidth = Math.max(width - margins.left - margins.right, 0)
  const innerHeight = Math.max(height - margins.top - margins.bottom, 0)

  const oscillatorCount = oscillatorPaneKeys.length
  const volumeHeight = innerHeight * VOLUME_RATIO
  const oscillatorHeight = oscillatorCount > 0 ? innerHeight * OSCILLATOR_RATIO : 0
  const priceHeight = innerHeight - volumeHeight - oscillatorHeight * oscillatorCount

  let cursor = margins.top
  const priceTop = cursor
  cursor += priceHeight

  const volumeTop = cursor
  cursor += volumeHeight

  const oscillators: OscillatorPaneSlot[] = oscillatorPaneKeys.map((key) => {
    const slot = { key, top: cursor, height: oscillatorHeight }
    cursor += oscillatorHeight
    return slot
  })

  return {
    priceTop,
    priceHeight,
    volumeTop,
    volumeHeight,
    oscillators,
    innerWidth,
    innerHeight,
  }
}

function seriesDomain(values: (number | null)[]): [number, number] {
  const nums = values.filter((v): v is number => v != null)
  if (nums.length === 0) return [0, 1]
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const pad = (max - min) * 0.1 || Math.abs(max) * 0.1 || 1
  return [min - pad, max + pad]
}

export function useChartScales(
  slots: ChartSlot[],
  layout: PaneLayout,
  margins: { left: number },
  oscillators: OscillatorRenderGroup[],
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

    const oscillatorScales = oscillators.map((group, index) => {
      const slot = layout.oscillators[index]
      const flatValues = group.outputs.flatMap((output) => output.values)
      const [min, max] =
        group.catalogId === 'rsi' ? ([0, 100] as [number, number]) : seriesDomain(flatValues)
      const scale = scaleLinear<number>({
        domain: [min, max],
        range: [(slot?.top ?? 0) + (slot?.height ?? 0), slot?.top ?? 0],
        nice: group.catalogId !== 'rsi',
      })
      return { key: group.instanceKey, scale }
    })

    return {
      xScale,
      priceScale,
      volumeScale,
      oscillatorScales,
      marginLeft: margins.left,
    }
  }, [slots, layout, margins.left, pricePanOffset, priceScaleFactor, oscillators])
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
