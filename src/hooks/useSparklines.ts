import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'

import { fetchOhlcv, marketDataKeys } from '@/api/queries/market-data'

const SPARKLINE_BAR_COUNT = 30
const SPARKLINE_MAX_SYMBOLS = 30
const SPARKLINE_STALE_TIME = 5 * 60_000

export function useSparklines(symbols: string[]) {
  const cappedSymbols = useMemo(() => symbols.slice(0, SPARKLINE_MAX_SYMBOLS), [symbols])

  const queries = useQueries({
    queries: cappedSymbols.map((symbol) => ({
      queryKey: marketDataKeys.ohlcv(symbol, '1D', { count: SPARKLINE_BAR_COUNT }),
      queryFn: () => fetchOhlcv(symbol, '1D', { count: SPARKLINE_BAR_COUNT }),
      staleTime: SPARKLINE_STALE_TIME,
      enabled: symbol.length > 0,
    })),
  })

  return useMemo(() => {
    const closesBySymbol: Record<string, number[]> = {}

    cappedSymbols.forEach((symbol, index) => {
      const bars = queries[index]?.data
      if (bars && bars.length > 0) {
        closesBySymbol[symbol] = bars.map((bar) => bar.close)
      }
    })

    return closesBySymbol
  }, [cappedSymbols, queries])
}
