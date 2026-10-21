import { useCallback, useEffect, useMemo, useState } from 'react'
import { scaleBand, scaleLinear } from '@visx/scale'

import type {
  ChartSlot,
  DataPoint,
  PaneLayout,
  ProcessedBar,
} from '@/components/charts/types/chart'
import type { BandScale, LinearScale } from '@/components/charts/types/scales'
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

/** Multiplies a stretch factor by the exponential step for a vertical drag of `deltaY` px. */
export function stretchScaleFactor(prev: number, deltaY: number): number {
  const factor = Math.exp(deltaY * PRICE_AXIS_STRETCH_SENSITIVITY)
  return Math.max(MIN_PRICE_SCALE_FACTOR, Math.min(MAX_PRICE_SCALE_FACTOR, prev * factor))
}

/** Stretches a [min, max] oscillator domain around its centre. */
export function applyOscillatorAxisScale(
  domain: [number, number],
  scaleFactor: number,
): [number, number] {
  const [min, max] = domain
  const center = (min + max) / 2
  const halfSpan = ((max - min) / 2) * scaleFactor
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
    setScaleFactor((prev) => stretchScaleFactor(prev, deltaY))
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
  oscillatorScaleFactors: Record<string, number> = {},
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

    const oscillatorScales = oscillators.map((group) => {
      const slot = layout.oscillators.find((item) => item.key === group.instanceKey)
      const flatValues = group.outputs.flatMap((output) => [
        ...output.values,
        ...(output.kind === 'histogram' ||
        (group.catalogId === 'macd' && output.outputKey === 'histogram')
          ? [output.baseline ?? 0]
          : []),
      ])
      const baseDomain: [number, number] =
        group.catalogId === 'rsi' ? [0, 100] : seriesDomain(flatValues)
      const domain = applyOscillatorAxisScale(
        baseDomain,
        oscillatorScaleFactors[group.instanceKey] ?? 1,
      )
      const scale = scaleLinear<number>({
        domain,
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
  }, [
    slots,
    layout,
    margins.left,
    pricePanOffset,
    priceScaleFactor,
    oscillators,
    oscillatorScaleFactors,
  ])
}

export function barCenterX(
  xScale: ReturnType<typeof scaleBand<string>>,
  timestamp: string,
): number {
  return (xScale(timestamp) ?? 0) + xScale.bandwidth() / 2
}

export function pointToXY(
  point: DataPoint,
  xScale: BandScale,
  priceScale: LinearScale,
  bars: ProcessedBar[],
): { x: number; y: number } | null {
  const bar = bars.find((b) => b.timestamp === point.timestamp)
  if (!bar) {
    const idx = bars.findIndex(
      (b) => new Date(b.timestamp).getTime() >= new Date(point.timestamp).getTime(),
    )
    const fallback = bars[Math.max(0, idx)] ?? bars[bars.length - 1]
    if (!fallback) return null
    return {
      x: barCenterX(xScale, fallback.timestamp),
      y: priceScale(point.price),
    }
  }
  return {
    x: barCenterX(xScale, bar.timestamp),
    y: priceScale(point.price),
  }
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
