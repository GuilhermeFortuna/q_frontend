import type { IndicatorCatalogEntry } from '../../../contracts/api'
import type { IndicatorSeriesByInstance } from '@/api/queries/marketIndicators'
import { indicatorInstanceKey, type IndicatorConfig } from '@/lib/market/indicatorConfig'
import { alignSeriesValuesToBars } from '@/lib/market/indicatorSeriesAlign'
import type { OhlcvBar } from '@/types/api'

export type PriceBandRenderGroup = {
  kind: 'bands'
  instanceKey: string
  catalogId: string
  upper: (number | null)[]
  /** Present only when the backend returns a middle output (Bollinger). */
  middle?: (number | null)[]
  lower: (number | null)[]
  config: IndicatorConfig
}

export type StudySeriesKind = 'line' | 'step' | 'markers' | 'histogram' | 'segment'
export type StudyMarkerShape =
  | 'circle'
  | 'square'
  | 'diamond'
  | 'triangle-up'
  | 'triangle-down'
  | 'cross'
export type StudyMarkerPosition = 'value' | 'above-bar' | 'below-bar'

export type PriceLineRenderGroup = {
  kind: StudySeriesKind
  instanceKey: string
  catalogId: string
  outputKey: string
  label: string
  values: (number | null)[]
  fillValues?: (number | null)[]
  fillKind?: StudySeriesKind
  fillOpacity?: number
  shape?: StudyMarkerShape
  size?: number
  position?: StudyMarkerPosition
  studyName?: string
  seriesLabel?: string
  /** Chart bar index of each segment start, aligned with `values`; used by `segment` only. */
  startIndex?: (number | null)[]
  config: IndicatorConfig
}

export type OscillatorOutputRender = {
  outputKey: string
  label: string
  values: (number | null)[]
  color?: string
  kind?: StudySeriesKind
  baseline?: number
  negativeColor?: string
  fillValues?: (number | null)[]
  fillKind?: StudySeriesKind
  fillOpacity?: number
  shape?: StudyMarkerShape
  size?: number
  position?: StudyMarkerPosition
  studyName?: string
  seriesLabel?: string
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
  series: IndicatorSeriesByInstance | undefined,
): IndicatorRenderModel {
  const entries = catalogById(catalog)
  const barTimestamps = bars.map((bar) => bar.timestamp)
  const enabled = indicators.filter((item) => item.enabled)

  const priceLines: PriceLineRenderGroup[] = []
  const priceBands: PriceBandRenderGroup[] = []
  const oscillators: OscillatorRenderGroup[] = []

  if (!series || enabled.length === 0) {
    return { priceLines, priceBands, oscillators }
  }

  const drawn = new Set<string>()

  for (const config of enabled) {
    const entry = entries.get(config.id)
    const instanceKey = indicatorInstanceKey(config)
    // Series are looked up by the instance that requested them. While a changed selection
    // is still loading, the previous response simply has no entry for the new instance.
    const instanceSeries = series.byInstance[instanceKey]
    if (!entry || !instanceSeries || drawn.has(instanceKey)) continue
    drawn.add(instanceKey)
    const priceOutputs: OscillatorOutputRender[] = []
    const oscillatorOutputs: OscillatorOutputRender[] = []

    for (const outputSpec of entry.outputs) {
      const raw = instanceSeries.find((output) => output.key === outputSpec.key)
      if (!raw) continue

      const values = alignSeriesValuesToBars(barTimestamps, series.timestamps, raw.values)
      const renderOutput: OscillatorOutputRender = {
        outputKey: outputSpec.key,
        kind: entry.id === 'macd' && outputSpec.key === 'histogram' ? 'histogram' : 'line',
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
        priceBands.push({
          kind: 'bands',
          instanceKey,
          catalogId: config.id,
          upper: upper.values,
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
