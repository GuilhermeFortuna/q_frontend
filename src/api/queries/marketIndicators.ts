import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import { toApiTimeframe } from '@/lib/market/timeframes'
import { indicatorInstanceKey, type IndicatorConfig } from '@/lib/market/indicatorConfig'
import { barRangeForSeries } from '@/lib/market/indicatorSeriesAlign'
import type {
  IndicatorCatalogResponse,
  MarketIndicatorSeriesRequest,
  MarketIndicatorSeriesResponse,
} from '../../../contracts/api'

export const marketIndicatorKeys = {
  all: ['market-indicators'] as const,
  catalog: () => [...marketIndicatorKeys.all, 'catalog'] as const,
  series: (symbol: string, timeframe: string, start: string, end: string, indicatorsKey: string) =>
    [...marketIndicatorKeys.all, 'series', symbol, timeframe, start, end, indicatorsKey] as const,
}

export async function fetchIndicatorCatalog(): Promise<IndicatorCatalogResponse> {
  const { data } = await apiClient.get<IndicatorCatalogResponse>('/api/v1/market/indicators')
  return data
}

export async function fetchMarketIndicatorSeries(
  symbol: string,
  body: MarketIndicatorSeriesRequest,
): Promise<MarketIndicatorSeriesResponse> {
  const { data } = await apiClient.post<MarketIndicatorSeriesResponse>(
    `/api/v1/market/indicators/${encodeURIComponent(symbol)}/series`,
    body,
  )
  return data
}

export function useIndicatorCatalog() {
  return useQuery({
    queryKey: marketIndicatorKeys.catalog(),
    queryFn: fetchIndicatorCatalog,
    staleTime: 5 * 60_000,
  })
}

export function useMarketIndicatorSeriesQuery(
  symbol: string,
  timeframe: string,
  bars: { timestamp: string }[],
  indicators: IndicatorConfig[],
) {
  const enabledIndicators = indicators.filter((item) => item.enabled)
  const range = barRangeForSeries(bars as Parameters<typeof barRangeForSeries>[0])
  const indicatorsKey = enabledIndicators.map((item) => indicatorInstanceKey(item)).join('|')

  return useQuery({
    queryKey: marketIndicatorKeys.series(
      symbol,
      timeframe,
      range?.start ?? '',
      range?.end ?? '',
      indicatorsKey,
    ),
    queryFn: () => {
      if (!range) {
        return Promise.resolve({
          timestamps: [],
          series: [],
        } satisfies MarketIndicatorSeriesResponse)
      }
      const body: MarketIndicatorSeriesRequest = {
        timeframe: toApiTimeframe(timeframe),
        start: range.start,
        end: range.end,
        indicators: enabledIndicators.map((item) => ({
          id: item.id,
          parameters: item.parameters,
        })),
      }
      return fetchMarketIndicatorSeries(symbol, body)
    },
    enabled: symbol.length > 0 && enabledIndicators.length > 0 && range !== null,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
}
