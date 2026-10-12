import { useMemo } from 'react'

import {
  indicatorRequestErrorMessage,
  unknownIndicatorIds,
  useIndicatorCatalog,
  useMarketIndicatorSeriesQuery,
} from '@/api/queries/marketIndicators'
import {
  buildIndicatorRenderModel,
  type IndicatorRenderModel,
} from '@/lib/market/buildIndicatorRenderModel'
import type { IndicatorConfig } from '@/lib/market/indicatorConfig'
import type { OhlcvBar } from '@/types/api'

const EMPTY_MODEL: IndicatorRenderModel = {
  priceLines: [],
  priceBands: [],
  oscillators: [],
}

export function useMarketIndicatorRenderModel(
  symbol: string,
  timeframe: string,
  bars: OhlcvBar[],
  indicators: IndicatorConfig[],
): {
  model: IndicatorRenderModel
  isLoading: boolean
  isFetching: boolean
  /** Why the selected indicators are not all drawn, or null when they are. */
  notice: string | null
} {
  const catalogQuery = useIndicatorCatalog()
  const catalog = catalogQuery.data?.indicators
  const seriesQuery = useMarketIndicatorSeriesQuery(symbol, timeframe, bars, indicators, catalog)

  const model = useMemo(() => {
    if (!catalog) return EMPTY_MODEL
    return buildIndicatorRenderModel(bars, indicators, catalog, seriesQuery.data)
  }, [bars, catalog, indicators, seriesQuery.data])

  const notice = useMemo(() => {
    const messages: string[] = []
    if (catalogQuery.error) messages.push(indicatorRequestErrorMessage(catalogQuery.error))
    if (seriesQuery.error) messages.push(indicatorRequestErrorMessage(seriesQuery.error))
    const unknown = catalog ? unknownIndicatorIds(indicators, catalog) : []
    if (unknown.length > 0) messages.push(`Not in the indicator catalog: ${unknown.join(', ')}.`)
    return messages.length > 0 ? messages.join(' ') : null
  }, [catalog, catalogQuery.error, indicators, seriesQuery.error])

  return {
    model,
    isLoading: catalogQuery.isLoading || seriesQuery.isLoading,
    isFetching: seriesQuery.isFetching,
    notice,
  }
}
