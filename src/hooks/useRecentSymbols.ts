import { useCallback, useState } from 'react'

const RECENT_SYMBOLS_KEY = 'quant_recent_symbols'
const MAX_RECENT_SYMBOLS = 8

export function useRecentSymbols() {
  const [recentSymbols, setRecentSymbols] = useState<string[]>(() => {
    const saved = localStorage.getItem(RECENT_SYMBOLS_KEY)
    return saved ? (JSON.parse(saved) as string[]) : []
  })

  const recordSymbol = useCallback((symbol: string) => {
    setRecentSymbols((current) => {
      const next = [symbol, ...current.filter((item) => item !== symbol)].slice(
        0,
        MAX_RECENT_SYMBOLS,
      )
      localStorage.setItem(RECENT_SYMBOLS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { recentSymbols, recordSymbol }
}
