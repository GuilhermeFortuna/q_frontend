import { useQuery } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import { toApiTimeframe } from '@/lib/market/timeframes'
import type { Instrument, MarketSnapshot, OhlcvBar } from '@/types/api'

export type OhlcvQueryParams = {
  count?: number
  start?: string
  end?: string
}

export const marketDataKeys = {
  all: ['market-data'] as const,
  instruments: () => [...marketDataKeys.all, 'instruments'] as const,
  snapshot: (symbol: string) => [...marketDataKeys.all, 'snapshot', symbol] as const,
  ohlcv: (symbol: string, timeframe: string, params?: OhlcvQueryParams) =>
    [...marketDataKeys.all, 'ohlcv', symbol, timeframe, params ?? {}] as const,
}

async function fetchInstruments(): Promise<Instrument[]> {
  const { data } = await apiClient.get<Instrument[]>('/api/v1/market/instruments')
  return data
}

async function fetchMarketSnapshot(symbol: string): Promise<MarketSnapshot> {
  const { data } = await apiClient.get<MarketSnapshot>(`/api/v1/market/snapshot/${symbol}`)
  return data
}

export async function fetchOhlcv(
  symbol: string,
  timeframe: string,
  params: OhlcvQueryParams = {},
): Promise<OhlcvBar[]> {
  const { count = 500, start, end } = params
  const { data } = await apiClient.get<OhlcvBar[]>(`/api/v1/market/ohlcv/${symbol}`, {
    params: {
      timeframe: toApiTimeframe(timeframe),
      count,
      ...(start ? { start } : {}),
      ...(end ? { end } : {}),
    },
  })
  return data
}

export function useInstruments() {
  return useQuery({
    queryKey: marketDataKeys.instruments(),
    queryFn: fetchInstruments,
    staleTime: 60_000,
  })
}

export function useMarketSnapshot(symbol: string) {
  return useQuery({
    queryKey: marketDataKeys.snapshot(symbol),
    queryFn: () => fetchMarketSnapshot(symbol),
    enabled: symbol.length > 0,
    staleTime: 10_000,
  })
}

export function useOhlcv(symbol: string, timeframe: string, params: OhlcvQueryParams = {}) {
  const queryParams = { count: 500, ...params }
  return useQuery({
    queryKey: marketDataKeys.ohlcv(symbol, timeframe, queryParams),
    queryFn: () => fetchOhlcv(symbol, timeframe, queryParams),
    enabled: symbol.length > 0,
    staleTime: 30_000,
  })
}

async function fetchSearchSymbols(query: string): Promise<Instrument[]> {
  if (!query.trim()) return []
  const { data } = await apiClient.get<Instrument[]>('/api/v1/market/symbols/search', {
    params: { q: query },
  })
  return data
}

export function useSearchSymbols(query: string) {
  return useQuery({
    queryKey: [...marketDataKeys.all, 'search', query] as const,
    queryFn: () => fetchSearchSymbols(query),
    enabled: query.trim().length > 1,
    staleTime: 30_000,
  })
}
