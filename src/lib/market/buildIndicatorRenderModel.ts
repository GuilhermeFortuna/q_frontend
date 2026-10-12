import type { IndicatorCatalogEntry, MarketIndicatorSeriesResponse } from '../../../contracts/api'
import type { IndicatorConfig } from '@/lib/market/indicatorConfig'
import { alignSeriesValuesToBars } from '@/lib/market/indicatorSeriesAlign'
import type { OhlcvBar } from '@/types/api'

export type PriceBandRenderGroup = {
  kind: 'bands'
  instanceKey: string
  catalogId: string
  upper: (number | null)[]
  middle: (number | null)[]
  lower: (number | null)[]
  config: IndicatorConfig
}

export type PriceLineRenderGroup = {
  kind: 'line'
  instanceKey: string
  catalogId: string
  outputKey: string
  label: string
  values: (number | null)[]
  config: IndicatorConfig
}

export type OscillatorOutputRender = {
  outputKey: string
  label: string
  values: (number | null)[]
  color?: string
  unavailableReason?: string | null
}

export type OscillatorRenderGroup = {
  instanceKey: string
  catalogId: string
  label: string
  unit?: string | null
  config: IndicatorConfig
  outputs: OscillatorOutputRender[]
}

export type IndicatorRenderModel = {
  priceLines: PriceLineRenderGroup[]
  priceBands: PriceBandRenderGroup[]
  oscillators: OscillatorRenderGroup[]
}

function catalogById(catalog: IndicatorCatalogEntry[]): Map<string, IndicatorCatalogEntry> {
  return new Map(catalog.map((entry) => [entry.id, entry]))
}

export function buildIndicatorRenderModel(
  bars: OhlcvBar[],
  indicators: IndicatorConfig[],
  catalog: IndicatorCatalogEntry[],
  seriesResponse: MarketIndicatorSeriesResponse | undefined,
): IndicatorRenderModel {
  const entries = catalogById(catalog)
  const barTimestamps = bars.map((bar) => bar.timestamp)
  const enabled = indicators.filter((item) => item.enabled)

  const priceLines: PriceLineRenderGroup[] = []
  const priceBands: PriceBandRenderGroup[] = []
  const oscillators: OscillatorRenderGroup[] = []

  if (!seriesResponse || enabled.length === 0) {
    return { priceLines, priceBands, oscillators }
  }

  let seriesCursor = 0

  for (const config of enabled) {
    const entry = entries.get(config.id)
    if (!entry) continue
    const instanceKey = `${config.id}:${JSON.stringify(config.parameters)}`
    const priceOutputs: OscillatorOutputRender[] = []
    const oscillatorOutputs: OscillatorOutputRender[] = []

    for (const outputSpec of entry.outputs) {
      const raw = seriesResponse.series[seriesCursor]
      seriesCursor += 1
      if (!raw) continue

      const values = alignSeriesValuesToBars(barTimestamps, seriesResponse.timestamps, raw.values)
      const renderOutput: OscillatorOutputRender = {
        outputKey: outputSpec.key,
        label: outputSpec.label,
        values,
        color: config.style?.outputColors?.[outputSpec.key] ?? config.style?.color,
        unavailableReason: raw.unavailableReason ?? null,
      }

      if (outputSpec.pane === 'price') {
        priceOutputs.push(renderOutput)
      } else {
        oscillatorOutputs.push(renderOutput)
      }
    }

    if (entry.id === 'bollinger' && priceOutputs.length >= 3) {
      const upper = priceOutputs.find((o) => o.outputKey === 'upper')
      const middle = priceOutputs.find((o) => o.outputKey === 'middle')
      const lower = priceOutputs.find((o) => o.outputKey === 'lower')
      if (upper && middle && lower) {
        priceBands.push({
          kind: 'bands',
          instanceKey,
          catalogId: config.id,
          upper: upper.values,
          middle: middle.values,
          lower: lower.values,
          config,
        })
        continue
      }
    }

    if (entry.id === 'donchian' && priceOutputs.length >= 2) {
      const upper = priceOutputs.find((o) => o.outputKey === 'upper')
      const lower = priceOutputs.find((o) => o.outputKey === 'lower')
      if (upper && lower) {
        const middle = upper.values.map((value, index) => {
          const low = lower.values[index]
          if (value == null || low == null) return null
          return (value + low) / 2
        })
        priceBands.push({
          kind: 'bands',
          instanceKey,
          catalogId: config.id,
          upper: upper.values,
          middle,
          lower: lower.values,
          config,
        })
        continue
      }
    }

    for (const output of priceOutputs) {
      if (output.outputKey === 'line' || priceOutputs.length === 1) {
        priceLines.push({
          kind: 'line',
          instanceKey: `${instanceKey}:${output.outputKey}`,
          catalogId: config.id,
          outputKey: output.outputKey,
          label: output.label,
          values: output.values,
          config,
        })
      }
    }

    if (oscillatorOutputs.length > 0) {
      oscillators.push({
        instanceKey,
        catalogId: config.id,
        label: entry.label,
        unit: entry.unit,
        config,
        outputs: oscillatorOutputs,
      })
    }
  }

  return { priceLines, priceBands, oscillators }
}
