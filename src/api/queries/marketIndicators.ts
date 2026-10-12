import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'

import { apiClient } from '@/api/client'
import { toApiTimeframe } from '@/lib/market/timeframes'
import { indicatorInstanceKey, type IndicatorConfig } from '@/lib/market/indicatorConfig'
import { barRangeForSeries } from '@/lib/market/indicatorSeriesAlign'
import type {
  IndicatorCatalogEntry,
  IndicatorCatalogResponse,
  MarketIndicatorSeriesOutput,
  MarketIndicatorSeriesRequest,
  MarketIndicatorSeriesResponse,
} from '../../../contracts/api'

export const marketIndicatorKeys = {
  all: ['market-indicators'] as const,
  catalog: () => [...marketIndicatorKeys.all, 'catalog'] as const,
  series: (symbol: string, timeframe: string, start: string, end: string, indicatorsKey: string) =>
    [...marketIndicatorKeys.all, 'series', symbol, timeframe, start, end, indicatorsKey] as const,
}

/** One response, with each indicator's outputs filed under the instance that asked for them. */
export type IndicatorSeriesByInstance = {
  timestamps: string[]
  byInstance: Record<string, MarketIndicatorSeriesOutput[]>
}

export type RequestedIndicator = {
  instanceKey: string
  config: IndicatorConfig
  entry: IndicatorCatalogEntry
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

/**
 * The enabled indicators the backend can compute, one per distinct instance. An identifier
 * the catalog does not list is left out: sending it would fail the whole request.
 */
export function requestableIndicators(
  indicators: IndicatorConfig[],
  catalog: IndicatorCatalogEntry[],
): RequestedIndicator[] {
  const entries = new Map(catalog.map((entry) => [entry.id, entry]))
  const requested = new Map<string, RequestedIndicator>()
  for (const config of indicators) {
    const entry = entries.get(config.id)
    if (!config.enabled || !entry) continue
    const instanceKey = indicatorInstanceKey(config)
    if (!requested.has(instanceKey)) requested.set(instanceKey, { instanceKey, config, entry })
  }
  return [...requested.values()]
}

/** Enabled indicators whose identifier the catalog does not list. */
export function unknownIndicatorIds(
  indicators: IndicatorConfig[],
  catalog: IndicatorCatalogEntry[],
): string[] {
  const known = new Set(catalog.map((entry) => entry.id))
  return [
    ...new Set(
      indicators.filter((item) => item.enabled && !known.has(item.id)).map((item) => item.id),
    ),
  ]
}

/**
 * The response lists outputs in request order. File them by instance here, while the
 * request is known, so a response can never be read against a different selection.
 */
export function seriesByInstance(
  response: MarketIndicatorSeriesResponse,
  requested: RequestedIndicator[],
): IndicatorSeriesByInstance {
  const byInstance: Record<string, MarketIndicatorSeriesOutput[]> = {}
  let cursor = 0
  for (const { instanceKey, entry } of requested) {
    byInstance[instanceKey] = response.series.slice(cursor, cursor + entry.outputs.length)
    cursor += entry.outputs.length
  }
  return { timestamps: response.timestamps, byInstance }
}

export function indicatorRequestErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail
    if (typeof detail === 'string' && detail.length > 0) return detail
  }
  return error instanceof Error ? error.message : 'Indicator request failed.'
}

export function useMarketIndicatorSeriesQuery(
  symbol: string,
  timeframe: string,
  bars: { timestamp: string }[],
  indicators: IndicatorConfig[],
  catalog: IndicatorCatalogEntry[] | undefined,
) {
  const requested = catalog ? requestableIndicators(indicators, catalog) : []
  const range = barRangeForSeries(bars)
  const indicatorsKey = requested.map((item) => item.instanceKey).join('|')

  return useQuery({
    queryKey: marketIndicatorKeys.series(
      symbol,
      timeframe,
      range?.start ?? '',
      range?.end ?? '',
      indicatorsKey,
    ),
    queryFn: async (): Promise<IndicatorSeriesByInstance> => {
      if (!range) return { timestamps: [], byInstance: {} }
      const response = await fetchMarketIndicatorSeries(symbol, {
        timeframe: toApiTimeframe(timeframe),
        start: range.start,
        end: range.end,
        indicators: requested.map(({ config }) => ({
          id: config.id,
          parameters: config.parameters,
        })),
      })
      return seriesByInstance(response, requested)
    },
    enabled: symbol.length > 0 && requested.length > 0 && range !== null,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
}
