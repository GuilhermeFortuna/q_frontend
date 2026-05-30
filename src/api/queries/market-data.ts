import { useQuery } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import type { Instrument, MarketSnapshot, OhlcvBar } from '@/types/api'

export const marketDataKeys = {
  all: ['market-data'] as const,
  instruments: () => [...marketDataKeys.all, 'instruments'] as const,
  snapshot: (symbol: string) => [...marketDataKeys.all, 'snapshot', symbol] as const,
  ohlcv: (symbol: string) => [...marketDataKeys.all, 'ohlcv', symbol] as const,
}

async function fetchInstruments(): Promise<Instrument[]> {
  const { data } = await apiClient.get<Instrument[]>('/api/v1/market/instruments')
  return data
}

async function fetchMarketSnapshot(symbol: string): Promise<MarketSnapshot> {
  const { data } = await apiClient.get<MarketSnapshot>(`/api/v1/market/snapshot/${symbol}`)
  return data
}

async function fetchOhlcv(symbol: string): Promise<OhlcvBar[]> {
  const { data } = await apiClient.get<OhlcvBar[]>(`/api/v1/market/ohlcv/${symbol}`)
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

export function useOhlcv(symbol: string) {
  return useQuery({
    queryKey: marketDataKeys.ohlcv(symbol),
    queryFn: () => fetchOhlcv(symbol),
    enabled: symbol.length > 0,
    staleTime: 30_000,
  })
}
