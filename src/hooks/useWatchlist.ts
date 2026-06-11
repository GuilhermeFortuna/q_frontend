import { useCallback, useEffect, useState } from 'react'

import type { Instrument } from '@/types/api'

const WATCHLIST_STORAGE_KEY = 'quant_watchlist'

export function useWatchlist(instruments: Instrument[] | undefined) {
  const [watchlist, setWatchlist] = useState<Instrument[]>(() => {
    const saved = localStorage.getItem(WATCHLIST_STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  })

  useEffect(() => {
    const saved = localStorage.getItem(WATCHLIST_STORAGE_KEY)
    if (!saved && instruments) {
      setWatchlist(instruments)
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(instruments))
    }
  }, [instruments])

  const addToWatchlist = useCallback((inst: Instrument) => {
    setWatchlist((current) => {
      if (current.some((item) => item.symbol === inst.symbol)) {
        return current
      }
      const next = [...current, inst]
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const removeFromWatchlist = useCallback((symbol: string) => {
    setWatchlist((current) => {
      const next = current.filter((item) => item.symbol !== symbol)
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return {
    watchlist,
    addToWatchlist,
    removeFromWatchlist,
  }
}
