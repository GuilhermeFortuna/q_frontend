import { useMemo } from 'react'

import type { IndicatorConfig } from '@/components/charts/types/chart'
import { bollingerBands, donchianChannels, ema, hma, sma, smma, wma } from '@/lib/indicators'
import type { OhlcvBar } from '@/types/api'

export type LineIndicatorSeries = {
  id: string
  kind: 'line'
  values: (number | null)[]
  config: Extract<IndicatorConfig, { type: 'sma' | 'ema' | 'wma' | 'hma' | 'smma' }>
}

export type BandsIndicatorSeries = {
  id: string
  kind: 'bands'
  upper: (number | null)[]
  lower: (number | null)[]
  middle: (number | null)[]
  config: Extract<IndicatorConfig, { type: 'bollinger' | 'donchian' }>
}

export type IndicatorSeries = LineIndicatorSeries | BandsIndicatorSeries

export function useIndicatorSeries(allBars: OhlcvBar[], indicators: IndicatorConfig[]) {
  const configKey = useMemo(() => JSON.stringify(indicators), [indicators])

  return useMemo(() => {
    const series: IndicatorSeries[] = []

    for (const ind of indicators) {
      if (!ind.enabled) continue

      switch (ind.type) {
        case 'sma':
          series.push({ id: 'sma', kind: 'line', values: sma(allBars, ind.period), config: ind })
          break
        case 'ema':
          series.push({ id: 'ema', kind: 'line', values: ema(allBars, ind.period), config: ind })
          break
        case 'wma':
          series.push({ id: 'wma', kind: 'line', values: wma(allBars, ind.period), config: ind })
          break
        case 'hma':
          series.push({ id: 'hma', kind: 'line', values: hma(allBars, ind.period), config: ind })
          break
        case 'smma':
          series.push({ id: 'smma', kind: 'line', values: smma(allBars, ind.period), config: ind })
          break
        case 'bollinger': {
          const bands = bollingerBands(allBars, ind.period, ind.stdDev)
          series.push({
            id: 'bollinger',
            kind: 'bands',
            upper: bands.upper,
            lower: bands.lower,
            middle: bands.middle,
            config: ind,
          })
          break
        }
        case 'donchian': {
          const bands = donchianChannels(allBars, ind.period)
          series.push({
            id: 'donchian',
            kind: 'bands',
            upper: bands.upper,
            lower: bands.lower,
            middle: bands.middle,
            config: ind,
          })
          break
        }
        default:
          break
      }
    }

    return series
  }, [allBars, configKey])
}
