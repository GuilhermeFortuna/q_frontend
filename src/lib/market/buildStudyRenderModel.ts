import type { ResearchStudyMetadata, ResearchStudySeriesResponse } from '../../../contracts/api'
import type {
  IndicatorRenderModel,
  OscillatorOutputRender,
  OscillatorRenderGroup,
  PriceLineRenderGroup,
} from '@/lib/market/buildIndicatorRenderModel'
import type { IndicatorConfig, IndicatorLineStyle } from '@/lib/market/indicatorConfig'
import { alignSeriesValuesToBars } from '@/lib/market/indicatorSeriesAlign'
import type { OhlcvBar } from '@/types/api'

/**
 * Colours for study series that set none. Hex, not CSS variables: the layers pass the
 * colour to SVG attributes, which do not resolve `var(...)` there. Matches the gold/brass
 * ramp of the chart theme.
 */
export const STUDY_SERIES_PALETTE = [
  '#c9a227',
  '#6eb5ff',
  '#a78bfa',
  '#26a69a',
  '#f97316',
  '#ef5350',
] as const

export type StudyRenderInput = {
  study: ResearchStudyMetadata
  response: ResearchStudySeriesResponse
}

export type StudyRenderResult = {
  model: IndicatorRenderModel
  /** One line per study whose points fall between bars. Nothing is moved to a neighbour. */
  notices: string[]
}

function studyConfig(
  studyId: string,
  color: string,
  lineStyle: IndicatorLineStyle | null | undefined,
  lineWidth: number | null | undefined,
): IndicatorConfig {
  return {
    id: `study:${studyId}`,
    enabled: true,
    parameters: {},
    style: {
      color,
      strokeWidth: lineWidth ?? 1.5,
      lineStyle: lineStyle ?? 'solid',
    },
  }
}

/** Places each enabled study's values on the bars with the same timestamp. */
export function buildStudyRenderModel(
  bars: OhlcvBar[],
  inputs: StudyRenderInput[],
): StudyRenderResult {
  const priceLines: PriceLineRenderGroup[] = []
  const oscillators: OscillatorRenderGroup[] = []
  const notices: string[] = []
  if (bars.length === 0) {
    return { model: { priceLines, priceBands: [], oscillators }, notices }
  }

  const barTimes = bars.map((bar) => bar.timestamp)
  const barInstants = new Set(barTimes.map((timestamp) => Date.parse(timestamp)))
  const firstInstant = Date.parse(barTimes[0])
  const lastInstant = Date.parse(barTimes[barTimes.length - 1])
  let paletteIndex = 0

  for (const { study, response } of inputs) {
    const valuesByKey = new Map(response.series.map((series) => [series.key, series.values]))

    const inRange = response.timestamps.filter((timestamp) => {
      const instant = Date.parse(timestamp)
      return instant >= firstInstant && instant <= lastInstant
    })
    const betweenBars = inRange.filter((timestamp) => !barInstants.has(Date.parse(timestamp)))
    if (betweenBars.length > 0) {
      notices.push(
        `${study.name}: ${betweenBars.length} of ${inRange.length} points fall between bars; check the timezone or whether timestamps are bar open times.`,
      )
    }

    const outputs: OscillatorOutputRender[] = []
    for (const meta of study.series) {
      const raw = valuesByKey.get(meta.key)
      if (!raw) continue
      const color = meta.color ?? STUDY_SERIES_PALETTE[paletteIndex++ % STUDY_SERIES_PALETTE.length]
      const values = alignSeriesValuesToBars(barTimes, response.timestamps, raw)
      const label = `${study.name} · ${meta.label}`

      if (meta.pane === 'price') {
        priceLines.push({
          kind: 'line',
          instanceKey: `study:${study.studyId}:${meta.key}`,
          catalogId: `study:${study.studyId}`,
          outputKey: meta.key,
          label,
          values,
          config: studyConfig(study.studyId, color, meta.lineStyle, meta.lineWidth),
        })
      } else {
        outputs.push({ outputKey: meta.key, label, values, color })
      }
    }

    if (outputs.length > 0) {
      oscillators.push({
        instanceKey: `study:${study.studyId}`,
        catalogId: `study:${study.studyId}`,
        label: study.name,
        config: studyConfig(study.studyId, STUDY_SERIES_PALETTE[0], null, null),
        outputs,
      })
    }
  }

  return { model: { priceLines, priceBands: [], oscillators }, notices }
}

/** Catalog indicators first, then studies. Neither set changes the other's entries. */
export function mergeIndicatorRenderModels(
  indicators: IndicatorRenderModel,
  studies: IndicatorRenderModel,
): IndicatorRenderModel {
  return {
    priceLines: [...indicators.priceLines, ...studies.priceLines],
    priceBands: [...indicators.priceBands, ...studies.priceBands],
    oscillators: [...indicators.oscillators, ...studies.oscillators],
  }
}
