import { indicatorRequestErrorMessage } from '@/api/queries/marketIndicators'
import { useResearchStudyList, useResearchStudySeriesQueries } from '@/api/queries/researchStudies'
import { toApiTimeframe } from '@/lib/market/timeframes'
import { buildStudyRenderModel } from '@/lib/market/buildStudyRenderModel'
import type { IndicatorRenderModel } from '@/lib/market/buildIndicatorRenderModel'
import { useEnabledStudyIds } from '@/lib/market/studySelection'
import { barRangeForSeries } from '@/lib/market/indicatorSeriesAlign'
import type { OhlcvBar } from '@/types/api'

const EMPTY_MODEL: IndicatorRenderModel = { priceLines: [], priceBands: [], oscillators: [] }

/**
 * Draws the enabled studies of the chart's symbol. A study on another timeframe is never
 * drawn, and a study whose values for the loaded range have not arrived is left out
 * until they do.
 */
export function useMarketStudyRenderModel(
  symbol: string,
  timeframe: string,
  bars: OhlcvBar[],
): { model: IndicatorRenderModel; notice: string | null } {
  const listQuery = useResearchStudyList(symbol)
  const enabledIds = useEnabledStudyIds(symbol)
  const apiTimeframe = toApiTimeframe(timeframe)
  const drawable = (listQuery.data?.items ?? []).filter(
    (study) => enabledIds.includes(study.studyId) && study.timeframe === apiTimeframe,
  )
  const range = barRangeForSeries(bars)
  const seriesQueries = useResearchStudySeriesQueries(drawable, range)

  const inputs = drawable.flatMap((study, index) => {
    const response = seriesQueries[index]?.data
    return response ? [{ study, response }] : []
  })
  const built = drawable.length > 0 ? buildStudyRenderModel(bars, inputs) : null

  const errors = [listQuery.error, ...seriesQueries.map((query) => query.error)]
    .filter((error) => error != null)
    .map((error) => indicatorRequestErrorMessage(error))
  const messages = [...errors, ...(built?.notices ?? [])]

  return {
    model: built?.model ?? EMPTY_MODEL,
    notice: messages.length > 0 ? messages.join(' ') : null,
  }
}
