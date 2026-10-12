import { useMemo } from 'react'

import { useIndicatorCatalog, useMarketIndicatorSeriesQuery } from '@/api/queries/marketIndicators'
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
} {
  const catalogQuery = useIndicatorCatalog()
  const seriesQuery = useMarketIndicatorSeriesQuery(symbol, timeframe, bars, indicators)

  const model = useMemo(() => {
    const catalog = catalogQuery.data?.indicators
    if (!catalog) return EMPTY_MODEL
    return buildIndicatorRenderModel(bars, indicators, catalog, seriesQuery.data)
  }, [bars, catalogQuery.data?.indicators, indicators, seriesQuery.data])

  return {
    model,
    isLoading: catalogQuery.isLoading || seriesQuery.isLoading,
    isFetching: seriesQuery.isFetching,
  }
}
